param(
  [Parameter(Mandatory = $true)]
  [string]$Prompt,

  [string]$BaseUrl = "http://localhost:3001"
)

# Submit one prompt as its own async queued job.
$body = @{ prompt = $Prompt } | ConvertTo-Json -Compress
$job = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/infer" -ContentType "application/json" -Body $body

Write-Host "Response is being created."
Write-Host "Prompt number: $($job.requestNumber)"
Write-Host "JobId: $($job.jobId)"
Write-Host "Timeout: $($job.timeoutMs)ms"
Write-Host "Your response when done will be available at: $BaseUrl$($job.resultPage)"
Write-Host "You can submit another prompt now as a separate command."
