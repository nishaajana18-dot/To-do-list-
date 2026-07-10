param(
  [string[]]$Prompts,

  [string]$BaseUrl = "http://localhost:3001",

  [int]$PollSeconds = 2,

  [int]$MaxWaitSeconds = 180,

  [switch]$Interactive
)

function Submit-PromptJob {
  param(
    [string]$Prompt,
    [string]$ApiBase
  )

  $body = @{ prompt = $Prompt } | ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri "$ApiBase/api/infer" -ContentType "application/json" -Body $body
}

function Get-PromptJob {
  param(
    [string]$JobId,
    [string]$ApiBase
  )

  return Invoke-RestMethod -Method Get -Uri "$ApiBase/api/infer/$JobId"
}

function Resolve-ResultPageUrl {
  param(
    [string]$ApiBase,
    [string]$ResultPage
  )

  if (-not $ResultPage) {
    return $null
  }

  if ($ResultPage -match "^https?://") {
    return $ResultPage
  }

  return "$ApiBase$ResultPage"
}

function Add-QueuedJob {
  param(
    [string]$Prompt,
    [string]$ApiBase,
    [System.Collections.Generic.List[object]]$JobStore
  )

  try {
    $submit = Submit-PromptJob -Prompt $Prompt -ApiBase $ApiBase
    $resultUrl = Resolve-ResultPageUrl -ApiBase $ApiBase -ResultPage $submit.resultPage

    # Track each prompt locally so terminal can poll statuses independently.
    $job = [PSCustomObject]@{
      Prompt = $Prompt
      JobId = $submit.jobId
      SubmittedAt = Get-Date
      LastStatus = "queued"
      Completed = $false
      Result = $null
      Error = $null
      ResultUrl = $resultUrl
    }
    $JobStore.Add($job) | Out-Null

    Write-Host ""
    Write-Host "Response is being created."
    Write-Host "JobId: $($job.JobId)"
    Write-Host "Your response when done will be available at: $($job.ResultUrl)"
    Write-Host "You can ask another prompt now."
  }
  catch {
    Write-Warning "Failed to queue prompt '$Prompt': $($_.Exception.Message)"
  }
}

function Update-PendingJobs {
  param(
    [string]$ApiBase,
    [System.Collections.Generic.List[object]]$JobStore
  )

  foreach ($job in ($JobStore | Where-Object { -not $_.Completed })) {
    try {
      $status = Get-PromptJob -JobId $job.JobId -ApiBase $ApiBase

      if ($status.status -ne $job.LastStatus) {
        Write-Host "[STATUS] JobId=$($job.JobId) $($job.LastStatus) -> $($status.status)"
        $job.LastStatus = $status.status
      }

      # Terminal state reached: stop polling this job.
      if ($status.status -in @("completed", "timed_out", "failed")) {
        $job.Completed = $true

        if ($status.status -eq "completed") {
          $job.Result = $status.response
          Write-Host "[RESPONSE READY] JobId=$($job.JobId)"
          Write-Host "Prompt: $($job.Prompt)"
          Write-Host "Response: $($job.Result)"
        }
        else {
          $job.Error = $status.error
          Write-Warning "[END:$($status.status)] JobId=$($job.JobId) Prompt='$($job.Prompt)' Error='$($job.Error)'"
        }
      }
    }
    catch {
      Write-Warning "Polling failed for JobId=$($job.JobId): $($_.Exception.Message)"
    }
  }
}

function Show-JobSummary {
  param([System.Collections.Generic.List[object]]$JobStore)

  if ($JobStore.Count -eq 0) {
    Write-Host "No jobs have been queued yet."
    return
  }

  $summary = $JobStore | Select-Object JobId, LastStatus, Prompt, ResultUrl
  $summary | Format-Table -AutoSize
}

$jobs = [System.Collections.Generic.List[object]]::new()

foreach ($prompt in $Prompts) {
  if ($prompt -and $prompt.Trim()) {
    Add-QueuedJob -Prompt $prompt.Trim() -ApiBase $BaseUrl -JobStore $jobs
  }
}

if ($Interactive -or $Prompts.Count -eq 0) {
  Write-Host ""
  Write-Host "Interactive queue mode."
  Write-Host "Type a prompt and press Enter to queue it."
  Write-Host "Commands: /status, /wait, /open <jobId>, /exit"

  while ($true) {
    # Keep polling asynchronously while waiting for next user input.
    Update-PendingJobs -ApiBase $BaseUrl -JobStore $jobs
    $inputText = Read-Host "Prompt or command"

    if (-not $inputText) {
      continue
    }

    if ($inputText -eq "/exit") {
      break
    }

    if ($inputText -eq "/status") {
      Show-JobSummary -JobStore $jobs
      continue
    }

    if ($inputText -eq "/wait") {
      $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
      while (($jobs | Where-Object { -not $_.Completed }).Count -gt 0 -and (Get-Date) -lt $deadline) {
        Update-PendingJobs -ApiBase $BaseUrl -JobStore $jobs
        Start-Sleep -Seconds $PollSeconds
      }

      if (($jobs | Where-Object { -not $_.Completed }).Count -gt 0) {
        Write-Warning "Some jobs are still pending after MaxWaitSeconds=$MaxWaitSeconds."
      }
      else {
        Write-Host "All queued jobs are finished."
      }
      continue
    }

    if ($inputText -match "^/open\s+(.+)$") {
      $jobId = $matches[1].Trim()
      $existing = $jobs | Where-Object { $_.JobId -eq $jobId } | Select-Object -First 1
      if ($existing -and $existing.ResultUrl) {
        Start-Process $existing.ResultUrl | Out-Null
        Write-Host "Opened $($existing.ResultUrl)"
      }
      else {
        Write-Warning "Job ID not found in this session."
      }
      continue
    }

    Add-QueuedJob -Prompt $inputText.Trim() -ApiBase $BaseUrl -JobStore $jobs
  }
}
else {
  $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
  while (($jobs | Where-Object { -not $_.Completed }).Count -gt 0 -and (Get-Date) -lt $deadline) {
    Update-PendingJobs -ApiBase $BaseUrl -JobStore $jobs
    Start-Sleep -Seconds $PollSeconds
  }
}

Write-Host ""
Write-Host "Final summary:"
Show-JobSummary -JobStore $jobs
