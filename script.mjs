#!/usr/bin/env zx

const model = 'gpt-3.5-turbo'
const maxFileLength = 5000
const maxResponseTokens = 1000

const title = `Review by ${model}`
const systemPrompt = `
# input
- code patch 
# What to do
We request the following
- Assist in conducting a brief code review
- Provide suggestions for improvements alongside the revisions
- Identify any potential issues

# Restrictions
The following points must be observed in the explanation.
- All languages must be output in Japanese when answering
- Output should be in Markdown format
- Refer to the output as described in [Output Format]

[Output format]
## ${title}
###<file name(1)>
- <suggestion for improvement(1)>
- <suggestion for improvement(2)>
### <file name(2)>
- <suggestion for improvement(1)>
- <suggestion for improvement(2)>
`.trim()

const getDiffFiles = async (baseCommit, latestCommit) => {
  const result = await $`git diff ${baseCommit} ${latestCommit} -U10 --diff-filter=ACM`.quiet()
  const diffs = result.stdout.split(/(?=diff --git a\/)/)
  const files = diffs.map(diff => {
    const name = diff.match(/(?<=diff --git a\/).*(?= b\/)/)[0]
    return {
      name,
      diff,
    }
  }).filter(file => file.diff.length < maxFileLength)
  console.log('filtered files: ', files.map(file => `${file.name} length: ${file.diff.length}`))
  return files.map(file => file.diff).join('\n')
}

const review = async (openAIKey, diffs) => {
  const endpoint = 'https://api.openai.com/v1/chat/completions'
  const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAIKey}`
  }
  
  const data = {
      model: model,
      messages: [
        {"role": "system", "content": systemPrompt},
        {"role": "user", "content": diffs}
      ],
      max_tokens: maxResponseTokens,
  }
  console.log(`request data length: system ${systemPrompt.length}, user ${diffs.length}`)
  
   const response = await fetch(endpoint, {
       method: 'POST',
       headers: headers,
       body: JSON.stringify(data)
   })

   const result = await response.json()
   console.log('openai response: ', result)
   return result.choices[0].message.content
}

const commentPullRequest = async (prNumber, reviewComment) => {
  await $`gh pr comment --body ${reviewComment} ${prNumber}`
}

const main = async () => {

  const baseCommit = process.env.BASE_SHA
  const prNumber = process.env.PR_NUMBER 
  if(!baseCommit || !prNumber || !process.env.GITHUB_TOKEN) {
    throw new Error('This function must be run in a pull request')
  }

  const openAIKey = process.env.OPENAI_API_KEY
  if(!openAIKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const lastCommit = 'HEAD'
  const diffs = await getDiffFiles(baseCommit, lastCommit)

  if(!diffs) {
    console.log('Not found files to review')
    return
  }

  const reviewComment = await review(openAIKey, diffs)

  await commentPullRequest(prNumber, reviewComment)

}

// exit code is always 0
await main().catch(console.error)
