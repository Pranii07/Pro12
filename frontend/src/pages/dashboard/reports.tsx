// ===========================================================
// NeuroScreen — Reports Page
// ===========================================================
// Lists generated PDF reports with download functionality.
// Fetches reports from the API and provides download links
// via signed Supabase Storage URLs.
//
// IMPORTANT: Reports contain Behavioural Screening Levels,
// NOT medical diagnoses.
// ===========================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  Download,
  Calendar,
  HardDrive,
  Loader2,
  AlertTriangle,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner'
import { reportApi } from '@/services/report-api'
import type { ReportListItem } from '@/services/report-api'
import { toast } from 'sonner'

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function ReportsPage() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const {
    data: reports,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportApi.list(),
    staleTime: 5 * 1000,
    refetchOnMount: 'always',
  })

  const handleDownload = async (report: ReportListItem) => {
    setDownloadingId(report.id)
    try {
      // Direct download is instant, self-contained, and reliably streams PDF
      await reportApi.directDownload(report.assessment_id)
      toast.success('Download completed', {
        description: report.file_name,
      })
    } catch (primaryErr) {
      console.warn('Direct download failed, trying storage download:', primaryErr)
      try {
        await reportApi.downloadFile(report.id, report.file_name)
        toast.success('Download completed', {
          description: report.file_name,
        })
      } catch (fallbackErr) {
        console.error('All download methods failed:', fallbackErr)
        toast.error('Download failed', {
          description: 'Could not download the report PDF. Please try again.',
        })
      }
    } finally {
      setDownloadingId(null)
    }
  }


  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader
          title="Reports"
          description="View and download your generated assessment reports"
        />
      </motion.div>

      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
      >
        <DisclaimerBanner variant="compact" />
      </motion.div>

      {/* Reports List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-accent" />
              Generated Reports
            </CardTitle>
            <CardDescription>
              PDF reports containing your assessment results and behavioural analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading reports...</span>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Failed to load reports</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Could not connect to the server. Please try again later.
                    </p>
                  </div>
                </div>
              </div>
            ) : reports && reports.length > 0 ? (
              <div className="space-y-3">
                {reports.map((report, index) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 * index }}
                  >
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                      {/* Left: File info */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="hidden sm:flex shrink-0 size-10 items-center justify-center rounded-xl bg-accent/10">
                          <FileText className="size-4 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {report.file_name}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDate(report.generated_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <HardDrive className="size-3" />
                              {formatFileSize(report.file_size_bytes)}
                            </span>
                            <Badge variant="outline" className="text-[0.6rem]">
                              PDF
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Right: Download button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 shrink-0"
                        onClick={() => handleDownload(report)}
                        disabled={downloadingId === report.id}
                      >
                        {downloadingId === report.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="No reports yet"
                description="Reports are generated after completing an assessment and viewing your results. Click 'Download Report' on any results page to generate your first PDF report."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
