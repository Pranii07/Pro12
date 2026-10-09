"""
NeuroScreen — Benchmark Repository
===================================
Data access layer for Cognitive Lab benchmarks with Supabase PostgreSQL
and persistent local JSON fallback.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.supabase_client import get_supabase_admin
from app.schemas.benchmark import (
    BenchmarkCreate,
    BenchmarkResponse,
    UserBenchmarkBest,
    UserBenchmarkProfile,
    AdminBenchmarkOverview,
    CognitiveDomainInsight,
    ClinicalBenchmarkSummary,
)

logger = logging.getLogger("neuroscreen.benchmarks")

LOCAL_STORE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "benchmarks_store.json"
)

# Cache whether remote Supabase table exists to avoid dozens of slow 404 network roundtrips
_has_remote_table: Optional[bool] = None


def _load_local_store() -> List[Dict[str, Any]]:
    """Load local JSON benchmark store."""
    if not os.path.exists(LOCAL_STORE_PATH):
        return []
    try:
        with open(LOCAL_STORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Error loading local benchmark store: {e}")
        return []


def _save_local_store(data: List[Dict[str, Any]]) -> None:
    """Save data to local JSON benchmark store."""
    os.makedirs(os.path.dirname(LOCAL_STORE_PATH), exist_ok=True)
    try:
        with open(LOCAL_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error saving local benchmark store: {e}")


def _is_better_score(test_type: str, new_score: float, current_best: float) -> bool:
    """Reaction and Aim: lower ms is better. Others: higher is better."""
    if test_type in ("reaction", "aim"):
        return new_score < current_best
    return new_score > current_best


def _check_remote_table() -> bool:
    """Check once if the user_benchmarks table exists in Supabase."""
    global _has_remote_table
    if _has_remote_table is not None:
        return _has_remote_table
    supabase = get_supabase_admin()
    if not supabase:
        _has_remote_table = False
        return False
    try:
        supabase.table("user_benchmarks").select("id").limit(1).execute()
        _has_remote_table = True
    except Exception:
        _has_remote_table = False
    return _has_remote_table


class BenchmarkRepository:
    """Repository managing Cognitive Lab benchmarks."""

    @staticmethod
    def record_benchmark(user_id: str, data: BenchmarkCreate) -> BenchmarkResponse:
        """Record a single benchmark attempt."""
        now_iso = datetime.now(timezone.utc).isoformat()
        record_id = str(uuid.uuid4())

        # Determine if this is a personal best
        existing_bests = BenchmarkRepository.get_user_bests(user_id)
        current_best = existing_bests.get(data.test_type)
        is_best = False
        if current_best is None:
            is_best = True
        else:
            is_best = _is_better_score(data.test_type, data.score, current_best.best_score)

        if _check_remote_table():
            supabase = get_supabase_admin()
            if supabase:
                try:
                    if is_best:
                        supabase.table("user_benchmarks").update({"is_best": False}).eq(
                            "user_id", user_id
                        ).eq("test_type", data.test_type).execute()

                    supabase.table("user_benchmarks").insert({
                        "id": record_id,
                        "user_id": user_id,
                        "test_type": data.test_type,
                        "score": data.score,
                        "unit": data.unit,
                        "details": data.details,
                        "is_best": is_best,
                        "created_at": now_iso,
                    }).execute()
                except Exception as e:
                    logger.info(f"Supabase user_benchmarks insert failed: {e}. Saved locally.")

        # Always update local store as reliable cache/fallback
        local_data = _load_local_store()
        if is_best:
            for item in local_data:
                if item.get("user_id") == user_id and item.get("test_type") == data.test_type:
                    item["is_best"] = False

        new_entry = {
            "id": record_id,
            "user_id": user_id,
            "test_type": data.test_type,
            "score": data.score,
            "unit": data.unit,
            "details": data.details,
            "is_best": is_best,
            "created_at": now_iso,
        }
        local_data.append(new_entry)
        _save_local_store(local_data)

        return BenchmarkResponse(
            id=record_id,
            user_id=user_id,
            test_type=data.test_type,
            score=data.score,
            unit=data.unit,
            details=data.details,
            is_best=is_best,
            created_at=datetime.fromisoformat(now_iso),
        )

    @staticmethod
    def get_user_bests(user_id: str) -> Dict[str, UserBenchmarkBest]:
        """Get a dictionary of personal bests by test type for a user."""
        bests: Dict[str, UserBenchmarkBest] = {}

        if _check_remote_table():
            supabase = get_supabase_admin()
            if supabase:
                try:
                    res = (
                        supabase.table("user_benchmarks")
                        .select("*")
                        .eq("user_id", user_id)
                        .execute()
                    )
                    if res.data:
                        for row in res.data:
                            tt = row["test_type"]
                            sc = float(row["score"])
                            unit = row.get("unit", "")
                            dt = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))

                            if tt not in bests:
                                bests[tt] = UserBenchmarkBest(
                                    test_type=tt,
                                    best_score=sc,
                                    unit=unit,
                                    attempts_count=1,
                                    last_tested_at=dt,
                                    )
                            else:
                                bests[tt].attempts_count += 1
                                if dt > bests[tt].last_tested_at:
                                    bests[tt].last_tested_at = dt
                                if _is_better_score(tt, sc, bests[tt].best_score):
                                    bests[tt].best_score = sc
                        return bests
                except Exception:
                    pass

        # Fallback to local store
        local_data = _load_local_store()
        for row in local_data:
            if row.get("user_id") == user_id:
                tt = row["test_type"]
                sc = float(row["score"])
                unit = row.get("unit", "")
                dt_str = row.get("created_at", "")
                try:
                    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                except Exception:
                    dt = datetime.now(timezone.utc)

                if tt not in bests:
                    bests[tt] = UserBenchmarkBest(
                        test_type=tt,
                        best_score=sc,
                        unit=unit,
                        attempts_count=1,
                        last_tested_at=dt,
                    )
                else:
                    bests[tt].attempts_count += 1
                    if dt > bests[tt].last_tested_at:
                        bests[tt].last_tested_at = dt
                    if _is_better_score(tt, sc, bests[tt].best_score):
                        bests[tt].best_score = sc

        return bests

    @staticmethod
    def get_user_history(user_id: str, limit: int = 25) -> List[BenchmarkResponse]:
        """Get recent attempts for a user."""
        if _check_remote_table():
            supabase = get_supabase_admin()
            if supabase:
                try:
                    res = (
                        supabase.table("user_benchmarks")
                        .select("*")
                        .eq("user_id", user_id)
                        .order("created_at", desc=True)
                        .limit(limit)
                        .execute()
                    )
                    if res.data:
                        return [
                            BenchmarkResponse(
                                id=r["id"],
                                user_id=r["user_id"],
                                test_type=r["test_type"],
                                score=float(r["score"]),
                                unit=r.get("unit", ""),
                                details=r.get("details", {}),
                                is_best=bool(r.get("is_best", False)),
                                created_at=datetime.fromisoformat(r["created_at"].replace("Z", "+00:00")),
                            )
                            for r in res.data
                        ]
                except Exception:
                    pass

        local_data = _load_local_store()
        user_rows = [r for r in local_data if r.get("user_id") == user_id]
        user_rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        results = []
        for r in user_rows[:limit]:
            try:
                dt = datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))
            except Exception:
                dt = datetime.now(timezone.utc)
            results.append(BenchmarkResponse(
                id=r["id"],
                user_id=r["user_id"],
                test_type=r["test_type"],
                score=float(r["score"]),
                unit=r.get("unit", ""),
                details=r.get("details", {}),
                is_best=bool(r.get("is_best", False)),
                created_at=dt,
            ))
        return results

    @staticmethod
    def _compute_clinical_summary(
        bests: Dict[str, UserBenchmarkBest],
        history: List[BenchmarkResponse],
    ) -> ClinicalBenchmarkSummary:
        domains: List[CognitiveDomainInsight] = []
        clinical_findings: List[str] = []
        z_scores_list: List[float] = []

        # 1. Reaction Time (Basal Ganglia / Subcortical)
        if "reaction" in bests:
            score = bests["reaction"].best_score
            z = round((260.0 - score) / 40.0, 2)
            norm_score = max(10.0, min(100.0, round(50.0 + z * 20.0, 1)))
            status = "OPTIMAL" if z >= 0.5 else "NORMAL" if z >= -1.0 else "BORDERLINE" if z >= -2.0 else "IMPAIRED"
            indicator = (
                f"Intact subcortical psychomotor speed ({score:.0f} ms, Z: {z:+.2f} SD); normal basal ganglia transmission."
                if z >= -1.0
                else f"Elevated latency ({score:.0f} ms, Z: {z:+.2f} SD); psychomotor bradyphrenia slowing noted."
            )
            domains.append(CognitiveDomainInsight(
                domain_key="reaction",
                domain_name="Psychomotor Speed & Reflex",
                brain_region="Basal Ganglia & Subcortical Pathways",
                test_type="reaction",
                raw_score=score,
                unit=bests["reaction"].unit,
                normalized_score=norm_score,
                z_score=z,
                clinical_status=status,
                clinical_indicator=indicator,
                associated_condition="Parkinson's Disease (Bradyphrenia / Motor Latency)",
            ))
            z_scores_list.append(z)
            if z < -1.5:
                clinical_findings.append(f"Subcortical psychomotor latency delay detected ({score:.0f} ms, Z: {z:+.2f} SD).")

        # 2. Verbal Memory (Temporal / Hippocampus)
        if "verbal" in bests:
            score = bests["verbal"].best_score
            z = round((score - 35.0) / 12.0, 2)
            norm_score = max(10.0, min(100.0, round(50.0 + z * 18.0, 1)))
            status = "OPTIMAL" if z >= 0.5 else "NORMAL" if z >= -1.0 else "BORDERLINE" if z >= -2.0 else "IMPAIRED"
            indicator = (
                f"Preserved episodic retention ({score:.0f} words, Z: {z:+.2f} SD); intact hippocampal verbal encoding."
                if z >= -1.0
                else f"Sub-baseline recall ({score:.0f} words, Z: {z:+.2f} SD); potential short-term verbal encoding deficit."
            )
            domains.append(CognitiveDomainInsight(
                domain_key="verbal",
                domain_name="Verbal Episodic Memory",
                brain_region="Medial Temporal Lobe & Hippocampus",
                test_type="verbal",
                raw_score=score,
                unit=bests["verbal"].unit,
                normalized_score=norm_score,
                z_score=z,
                clinical_status=status,
                clinical_indicator=indicator,
                associated_condition="Early Alzheimer's Disease & Amnestic MCI",
            ))
            z_scores_list.append(z)
            if z < -1.5:
                clinical_findings.append(f"Episodic verbal memory retrieval below expected baseline ({score:.0f} words, Z: {z:+.2f} SD).")

        # 3. Digit Span (DLPFC / Prefrontal)
        if "number" in bests:
            score = bests["number"].best_score
            z = round((score - 7.0) / 1.5, 2)
            norm_score = max(10.0, min(100.0, round(50.0 + z * 20.0, 1)))
            status = "OPTIMAL" if z >= 0.5 else "NORMAL" if z >= -1.0 else "BORDERLINE" if z >= -2.0 else "IMPAIRED"
            indicator = (
                f"Intact working phonological span ({score:.0f} digits, Z: {z:+.2f} SD); normal prefrontal executive attention."
                if z >= -1.0
                else f"Constrained digit span ({score:.0f} digits, Z: {z:+.2f} SD); reduced prefrontal working memory capacity."
            )
            domains.append(CognitiveDomainInsight(
                domain_key="number",
                domain_name="Working Memory & Phonological Loop",
                brain_region="Dorsolateral Prefrontal Cortex (DLPFC)",
                test_type="number",
                raw_score=score,
                unit=bests["number"].unit,
                normalized_score=norm_score,
                z_score=z,
                clinical_status=status,
                clinical_indicator=indicator,
                associated_condition="Frontotemporal / Executive Cognitive Decline",
            ))
            z_scores_list.append(z)
            if z < -1.5:
                clinical_findings.append(f"Reduced phonological working memory capacity ({score:.0f} digits, Z: {z:+.2f} SD).")

        # 4. Visual Memory Grid (Parieto-Occipital)
        if "visual" in bests:
            score = bests["visual"].best_score
            z = round((score - 7.0) / 2.0, 2)
            norm_score = max(10.0, min(100.0, round(50.0 + z * 18.0, 1)))
            status = "OPTIMAL" if z >= 0.5 else "NORMAL" if z >= -1.0 else "BORDERLINE" if z >= -2.0 else "IMPAIRED"
            indicator = (
                f"Intact spatial pattern encoding (Level {score:.0f}, Z: {z:+.2f} SD); normal parieto-occipital integration."
                if z >= -1.0
                else f"Visuospatial working memory attenuation (Level {score:.0f}, Z: {z:+.2f} SD)."
            )
            domains.append(CognitiveDomainInsight(
                domain_key="visual",
                domain_name="Visuospatial Pattern Memory",
                brain_region="Right Parietal & Occipital Cortex",
                test_type="visual",
                raw_score=score,
                unit=bests["visual"].unit,
                normalized_score=norm_score,
                z_score=z,
                clinical_status=status,
                clinical_indicator=indicator,
                associated_condition="Lewy Body Dementia & Vascular Visuospatial Impairment",
            ))
            z_scores_list.append(z)
            if z < -1.5:
                clinical_findings.append(f"Visuospatial memory pattern attenuation (Level {score:.0f}, Z: {z:+.2f} SD).")

        # 5. Chimp Test (Frontoparietal Sequence)
        if "chimp" in bests:
            score = bests["chimp"].best_score
            z = round((score - 8.0) / 2.0, 2)
            norm_score = max(10.0, min(100.0, round(50.0 + z * 18.0, 1)))
            status = "OPTIMAL" if z >= 0.5 else "NORMAL" if z >= -1.0 else "BORDERLINE" if z >= -2.0 else "IMPAIRED"
            indicator = (
                f"Preserved visual working memory & sequence planning ({score:.0f} numbers, Z: {z:+.2f} SD)."
                if z >= -1.0
                else f"Working memory occlusion vulnerability ({score:.0f} numbers, Z: {z:+.2f} SD)."
            )
            domains.append(CognitiveDomainInsight(
                domain_key="chimp",
                domain_name="Sequential Working Memory & Planning",
                brain_region="Frontoparietal Attention Network",
                test_type="chimp",
                raw_score=score,
                unit=bests["chimp"].unit,
                normalized_score=norm_score,
                z_score=z,
                clinical_status=status,
                clinical_indicator=indicator,
                associated_condition="Frontal Lobe Executive Dysfunction",
            ))
            z_scores_list.append(z)

        # 6. Aim Trainer (Cerebellum & Motor Cortex)
        if "aim" in bests:
            score = bests["aim"].best_score
            z = round((480.0 - score) / 75.0, 2)
            norm_score = max(10.0, min(100.0, round(50.0 + z * 20.0, 1)))
            status = "OPTIMAL" if z >= 0.5 else "NORMAL" if z >= -1.0 else "BORDERLINE" if z >= -2.0 else "IMPAIRED"
            indicator = (
                f"Target acquisition and motor latency within normal limits ({score:.0f} ms, Z: {z:+.2f} SD); intact cerebellar motor coordination."
                if z >= -1.0
                else f"Motor acquisition delay ({score:.0f} ms, Z: {z:+.2f} SD); potential motor coordination deficit or tremor."
            )
            domains.append(CognitiveDomainInsight(
                domain_key="aim",
                domain_name="Motor Coordination & Target Acquisition",
                brain_region="Cerebellum & Motor Cortex",
                test_type="aim",
                raw_score=score,
                unit=bests["aim"].unit,
                normalized_score=norm_score,
                z_score=z,
                clinical_status=status,
                clinical_indicator=indicator,
                associated_condition="Cerebellar Ataxia & Tremor Syndromes",
            ))
            z_scores_list.append(z)
            if z < -1.5:
                clinical_findings.append(f"Motor coordination latency delay detected ({score:.0f} ms, Z: {z:+.2f} SD).")

        # Longitudinal trend analysis
        longitudinal_trend = "STABLE"
        if len(history) >= 2:
            reaction_attempts = [h for h in history if h.test_type == "reaction"]
            if len(reaction_attempts) >= 2:
                newest = reaction_attempts[0].score
                oldest = reaction_attempts[-1].score
                if newest > oldest * 1.3:
                    longitudinal_trend = "DECLINING"
                elif newest < oldest * 0.8:
                    longitudinal_trend = "IMPROVING"

        # Overall Stability & Profile
        composite = round(sum(d.normalized_score for d in domains) / len(domains), 1) if domains else 50.0
        min_z = min(z_scores_list) if z_scores_list else 0.0

        if min_z < -2.0 or longitudinal_trend == "DECLINING":
            overall_stability = "DECLINE_ALERT"
            primary_profile = "Neurological Deficit Detected (Review Clinical Follow-up)"
        elif min_z < -1.2:
            overall_stability = "MILD_FLUCTUATION"
            primary_profile = "Borderline Cognitive/Motor Variation"
        else:
            overall_stability = "STABLE"
            primary_profile = "Stable Neurological Baseline"

        if not clinical_findings:
            clinical_findings.append("All measured cognitive and psychomotor domains remain within normal age-adjusted baselines.")
            clinical_findings.append("No acute indicators of Parkinsonian bradyphrenia or hippocampal episodic memory decay.")

        return ClinicalBenchmarkSummary(
            overall_stability=overall_stability,
            composite_cognitive_index=composite,
            domains=domains,
            clinical_findings=clinical_findings,
            longitudinal_trend=longitudinal_trend,
            primary_neurological_profile=primary_profile,
        )

    @staticmethod
    def get_admin_user_profile(user_id: str) -> Optional[UserBenchmarkProfile]:
        """Get full benchmark dossier for a specific user."""
        bests = BenchmarkRepository.get_user_bests(user_id)
        history = BenchmarkRepository.get_user_history(user_id, limit=30)
        total_tests = sum(b.attempts_count for b in bests.values())
        last_active = history[0].created_at if history else None
        clinical_summary = BenchmarkRepository._compute_clinical_summary(bests, history)

        # Fetch profile info and email
        supabase = get_supabase_admin()
        full_name = f"User {user_id[:6]}"
        email = None
        role = "USER"

        if supabase:
            try:
                prof = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
                if prof.data:
                    full_name = prof.data.get("full_name") or full_name
                    role = prof.data.get("role") or role
            except Exception:
                pass
            try:
                u_auth = supabase.auth.admin.get_user_by_id(user_id)
                if u_auth and u_auth.user:
                    email = u_auth.user.email
            except Exception:
                pass

        return UserBenchmarkProfile(
            user_id=user_id,
            full_name=full_name,
            email=email,
            role=role,
            bests=bests,
            recent_attempts=history,
            total_tests_taken=total_tests,
            last_active=last_active,
            clinical_summary=clinical_summary,
        )

    @staticmethod
    def get_users_test_counts() -> Dict[str, int]:
        """Get total cognitive tests taken keyed by user_id for quick table display (excluding admins)."""
        counts: Dict[str, int] = {}
        supabase = get_supabase_admin()
        admin_ids = set()
        if supabase:
            try:
                admins_res = supabase.table("profiles").select("id").eq("role", "ADMIN").execute()
                admin_ids = {str(a["id"]) for a in (admins_res.data or [])}
            except Exception:
                pass

        local_data = _load_local_store()
        for r in local_data:
            uid = r.get("user_id")
            if uid and uid not in admin_ids:
                counts[uid] = counts.get(uid, 0) + 1
        return counts

    @staticmethod
    def get_admin_all_profiles() -> List[UserBenchmarkProfile]:
        """Get benchmark profiles for all registered patient users (excluding admins)."""
        supabase = get_supabase_admin()
        profiles_map = {}
        email_map = {}

        if supabase:
            try:
                res = supabase.table("profiles").select("id, full_name, role").execute()
                for p in res.data or []:
                    profiles_map[str(p["id"])] = {
                        "full_name": p.get("full_name", ""),
                        "role": p.get("role", "USER"),
                    }
            except Exception:
                pass

            try:
                auth_users = supabase.auth.admin.list_users()
                for u in auth_users:
                    email_map[str(u.id)] = u.email
            except Exception:
                pass

        # Collect user IDs from local store or supabase
        user_ids = set(profiles_map.keys())
        local_data = _load_local_store()
        for r in local_data:
            if "user_id" in r:
                user_ids.add(r["user_id"])

        results = []
        for uid in user_ids:
            # Strictly exclude admins from patient benchmarks
            if uid in profiles_map and profiles_map[uid]["role"] == "ADMIN":
                continue

            prof = BenchmarkRepository.get_admin_user_profile(uid)
            if prof and prof.total_tests_taken > 0 and prof.role != "ADMIN":
                if uid in profiles_map:
                    prof.full_name = profiles_map[uid]["full_name"] or prof.full_name
                    prof.role = profiles_map[uid]["role"]
                if uid in email_map:
                    prof.email = email_map[uid]
                results.append(prof)

        results.sort(key=lambda x: x.last_active or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return results

    @staticmethod
    def get_admin_overview() -> AdminBenchmarkOverview:
        """Get platform-wide overview statistics for admin console."""
        all_profiles = BenchmarkRepository.get_admin_all_profiles()
        total_attempts = sum(p.total_tests_taken for p in all_profiles)

        # Averages across all bests
        reaction_scores = []
        verbal_scores = []
        number_scores = []
        aim_scores = []
        test_counts: Dict[str, int] = {}

        for p in all_profiles:
            for tt, best in p.bests.items():
                test_counts[tt] = test_counts.get(tt, 0) + best.attempts_count
                if tt == "reaction":
                    reaction_scores.append(best.best_score)
                elif tt == "verbal":
                    verbal_scores.append(best.best_score)
                elif tt == "number":
                    number_scores.append(best.best_score)
                elif tt == "aim":
                    aim_scores.append(best.best_score)

        avg_reaction = round(sum(reaction_scores) / len(reaction_scores), 1) if reaction_scores else None
        avg_verbal = round(sum(verbal_scores) / len(verbal_scores), 1) if verbal_scores else None
        avg_number = round(sum(number_scores) / len(number_scores), 1) if number_scores else None
        avg_aim = round(sum(aim_scores) / len(aim_scores), 1) if aim_scores else None

        most_pop = max(test_counts, key=test_counts.get) if test_counts else "reaction"

        # Recent 10 attempts across platform
        recent_all: List[BenchmarkResponse] = []
        for p in all_profiles:
            recent_all.extend(p.recent_attempts)
        recent_all.sort(key=lambda x: x.created_at, reverse=True)

        return AdminBenchmarkOverview(
            total_attempts=total_attempts,
            active_users_count=len(all_profiles),
            avg_reaction_time_ms=avg_reaction,
            avg_verbal_score=avg_verbal,
            avg_number_span=avg_number,
            avg_aim_time_ms=avg_aim,
            most_popular_test=most_pop,
            recent_activity=recent_all[:10],
        )

