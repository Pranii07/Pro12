"""
Backfill predictions for all completed assessments that don't have predictions yet.
Also generate initial reports so reports history is populated.
"""
from app.core.config import get_settings
from app.ml.model_loader import init_model_loader
from app.ml.predictor import predict_screening
from app.reports.report_generator import generate_assessment_report
from app.core.supabase_client import get_supabase_admin
from datetime import datetime, timezone

settings = get_settings()
init_model_loader(
    model_path=settings.resolved_ml_model_path,
    preprocessor_path=settings.resolved_ml_preprocessor_path,
    metadata_path=settings.resolved_ml_model_metadata_path,
)

db = get_supabase_admin()
assessments = db.table("assessments").select("*").eq("status", "completed").order("created_at").execute().data or []
print(f"Found {len(assessments)} completed assessments.")

for a in assessments:
    aid = a["id"]
    uid = a["user_id"]
    existing_pred = db.table("predictions").select("*").eq("assessment_id", aid).execute().data
    
    mods = db.table("module_results").select("*").eq("assessment_id", aid).execute().data or []
    module_dict = {"typing": None, "memory": None, "reaction": None, "speech": None, "facial": None}
    for m in mods:
        if m.get("status") == "completed" and m.get("features"):
            module_dict[m["module_type"]] = m["features"]
    
    pred_data = None
    if existing_pred:
        print(f"Assessment {aid} already has prediction.")
        pred_data = existing_pred[0]
    else:
        if any(v is not None for v in module_dict.values()):
            res = predict_screening(module_dict)
            features_with_scores = dict(res.get("features_used", {}))
            features_with_scores["_module_scores"] = res.get("module_scores", {})
            insert_data = {
                "assessment_id": aid,
                "model_version": res.get("model_version", "unknown"),
                "model_name": res.get("model_name", "unknown"),
                "screening_level": res["screening_level"],
                "overall_score": res.get("overall_score"),
                "model_distribution": res.get("model_distribution", {}),
                "features_used": features_with_scores,
                "modalities_present": res.get("modalities_present", {}),
            }
            saved = db.table("predictions").insert(insert_data).execute()
            if saved.data:
                pred_data = saved.data[0]
                print(f"Inserted prediction for {aid}: {pred_data['screening_level']}, score={pred_data.get('overall_score')}")

    
    if pred_data:
        # Check if report already exists
        existing_report = db.table("reports").select("id").eq("assessment_id", aid).execute().data
        if not existing_report:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            file_name = f"neuroscreen_report_{aid[:8]}_{timestamp}.pdf"
            pdf_bytes = generate_assessment_report(
                assessment=a,
                modules=mods,
                prediction=pred_data,
                user_name="User",
            )
            report_data = {
                "assessment_id": aid,
                "user_id": uid,
                "storage_path": f"reports/{uid}/{file_name}",
                "file_name": file_name,
                "file_size_bytes": len(pdf_bytes),
            }
            rep_saved = db.table("reports").insert(report_data).execute()
            if rep_saved.data:
                print(f"Created report record for {aid}: {file_name} ({len(pdf_bytes)} bytes)")

print("Backfill complete!")
