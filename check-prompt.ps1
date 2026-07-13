param(
  [Parameter(Mandatory = $true)]
  [string]$JobId,

  [string]$BaseUrl = "http://localhost:3001"
)

# Check one queued job's latest status/result.
$status = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/infer/$JobId"

Write-Host "JobId: $($status.jobId)"
Write-Host "Prompt number: $($status.requestNumber)"
Write-Host "Status: $($status.status)"
Write-Host "Timeout: $($status.timeoutMs)ms"

if ($status.status -eq "completed") {
  Write-Host "Response: $($status.response)"
} elseif ($status.status -in @("failed", "timed_out")) {
  Write-Host "Error: $($status.error)"
} else {
  Write-Host "Response not ready yet."
}

Write-Host "Track page: $BaseUrl/llm-job/$($status.jobId)"
