import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import Dockerode from 'dockerode'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import stream from 'stream'

const app = new Hono()

app.use('/*', cors({ origin: 'http://localhost:5173' }))
app.get('/', (c) => c.text('Sandbox API is running securely! Docker connected.'))

const isWindows = process.platform === 'win32'
const docker = new Dockerode({ 
  socketPath: isWindows ? '//./pipe/docker_engine' : '/var/run/docker.sock' 
})

app.post('/run', async (c) => {
  const body = await c.req.json()
  const code = body.code
  
  if (!code) {
    return c.json({ error: 'No code provided' }, 400)
  }

  const start = Date.now()
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devkarm-sandbox-'))
  const scriptPath = path.join(tmpDir, 'script.js')
  
  // Create script file inside the temporary directory
  await fs.writeFile(scriptPath, code)

  let stdout = ''
  let stderr = ''
  let exitCode = 1

  const stdoutStream = new stream.PassThrough()
  const stderrStream = new stream.PassThrough()
  
  stdoutStream.on('data', chunk => stdout += chunk.toString('utf8'))
  stderrStream.on('data', chunk => stderr += chunk.toString('utf8'))

  try {
    const imageName = 'node:22-alpine'
    // Auto-pull the image if it's missing (or just ensure it's there)
    await new Promise((resolve, reject) => {
      docker.pull(imageName, (err, stream) => {
        if (err) {
          // Fallback resolve if pull fails but image might already exist
          return reject(err)
        }
        // Wait for the download stream to finish
        docker.modem.followProgress(stream, (onFinishedErr) => {
          if (onFinishedErr) return reject(onFinishedErr)
          resolve()
        })
      })
    })

    // SECURITY CRITICAL: ephemeral Docker container, NetworkMode: 'none', 256MB memory limit, AutoRemove
    const runResult = await docker.run(imageName, ['node', '/sandbox/script.js'], [stdoutStream, stderrStream], {
      HostConfig: {
        Binds: [`${tmpDir}:/sandbox`],
        NetworkMode: 'none',
        Memory: 256 * 1024 * 1024, // 256MB
        AutoRemove: true,
      }
    })
    
    // docker.run returns an array [data, container]
    exitCode = runResult[0].StatusCode
  } catch (error) {
    return c.json({ 
      stdout: '', 
      stderr: 'Sandbox Error: ' + error.message, 
      exitCode: -1, 
      durationMs: 0 
    })
  } finally {
    // Auto-clean the temp directory
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(console.error)
  }

  const durationMs = Date.now() - start
  return c.json({ stdout, stderr, exitCode, durationMs })
})

app.post('/run-server', async (c) => {
  const body = await c.req.json()
  const code = body.code
  
  if (!code) return c.json({ error: 'No code provided' }, 400)

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devkarm-sandbox-server-'))
  const scriptPath = path.join(tmpDir, 'script.js')
  await fs.writeFile(scriptPath, code)

  try {
    const imageName = 'node:22-alpine'
    await new Promise((resolve, reject) => {
      docker.pull(imageName, (err, stream) => {
        if (err) return reject(err)
        docker.modem.followProgress(stream, (err2) => {
          if (err2) return reject(err2)
          resolve()
        })
      })
    })

    const container = await docker.createContainer({
      Image: imageName,
      Cmd: ['node', '/sandbox/script.js'],
      ExposedPorts: {
        '3000/tcp': {}
      },
      HostConfig: {
        Binds: [`${tmpDir}:/sandbox`],
        PortBindings: { '3000/tcp': [{ HostPort: '4001' }] },
        Memory: 256 * 1024 * 1024,
        AutoRemove: true
      }
    })

    await container.start()
    
    // Wait ~2 seconds for the server to boot
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return c.json({ port: 4001, status: 'running', containerId: container.id })
  } catch (error) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(console.error)
    return c.json({ stdout: '', stderr: 'Sandbox Server Error: ' + error.message, exitCode: -1, durationMs: 0 })
  }
})

app.delete('/run-server/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const container = docker.getContainer(id)
    await container.stop({ t: 2 }).catch(() => container.kill())
    return c.json({ status: 'stopped' })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

serve({
  fetch: app.fetch,
  port: 4000
}, (info) => {
  console.log(`Sandbox Server is running on port ${info.port}`)
})
