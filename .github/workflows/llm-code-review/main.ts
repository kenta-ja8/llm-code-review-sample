import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'

async function Exec(command: string, args: string[]): Promise<string>
{
  let output = ''

  const options: exec.ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    }
  }

  await exec.exec(command, args, options)

  return output
}

const main = async () => {
  console.log('Hello World!');
  core.startGroup(`Diff`)
  const result = await Exec('git', ['diff', github.context.payload.pull_request?.base.sha, 'HEAD'])
  console.log('result', result)
  core.info(result)
  core.endGroup()
}

main();
