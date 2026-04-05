import fetch from 'node-fetch'

const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700'
const MEILI_KEY = process.env.MEILI_MASTER_KEY || 'devkarm_search_key'
const NPM_REGISTRY = 'https://registry.npmjs.org/-/v1/search'

const PAGE_SIZE = 250
const TOTAL_PACKAGES = 5000
const DELAY_MS = 1000

async function ensureIndex() {
  const res = await fetch(`${MEILI_URL}/indexes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MEILI_KEY}`,
    },
    body: JSON.stringify({
      uid: 'packages',
      primaryKey: 'name',
    }),
  })
  if (!res.ok && res.status !== 409) {
    const body = await res.text()
    throw new Error(`Failed to create index: ${res.status} ${body}`)
  }
  console.log('Index "packages" ready.')
}

async function configureIndex() {
  const res = await fetch(`${MEILI_URL}/indexes/packages/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MEILI_KEY}`,
    },
    body: JSON.stringify({
      searchableAttributes: ['name', 'description', 'keywords'],
      displayedAttributes: ['name', 'description', 'version', 'keywords', 'date', 'links'],
      sortableAttributes: ['date'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to configure index: ${res.status} ${body}`)
  }
  console.log('Index settings configured.')
}

async function fetchPage(from) {
  const url = `${NPM_REGISTRY}?text=*&size=${PAGE_SIZE}&from=${from}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`npm registry fetch failed: ${res.status} at from=${from}`)
  }
  const data = await res.json()
  return data.objects || []
}

function transformPackage(obj) {
  const pkg = obj.package || {}
  return {
    name: pkg.name || '',
    description: pkg.description || '',
    version: pkg.version || '',
    keywords: pkg.keywords || [],
    date: pkg.date || '',
    links: pkg.links || {},
  }
}

async function pushDocuments(docs) {
  const res = await fetch(`${MEILI_URL}/indexes/packages/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MEILI_KEY}`,
    },
    body: JSON.stringify(docs),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to push documents: ${res.status} ${body}`)
  }
  const result = await res.json()
  return result
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('Starting npm package indexer...')
  console.log(`MeiliSearch: ${MEILI_URL}`)
  console.log(`Target: ${TOTAL_PACKAGES} packages in batches of ${PAGE_SIZE}`)

  await ensureIndex()
  await configureIndex()

  let totalIndexed = 0
  const pages = Math.ceil(TOTAL_PACKAGES / PAGE_SIZE)

  for (let page = 0; page < pages; page++) {
    const from = page * PAGE_SIZE
    console.log(`\nFetching page ${page + 1}/${pages} (from=${from})...`)

    let objects
    try {
      objects = await fetchPage(from)
    } catch (err) {
      console.error(`  Error fetching page: ${err.message}. Skipping.`)
      await sleep(DELAY_MS)
      continue
    }

    if (objects.length === 0) {
      console.log('  No more packages returned. Stopping early.')
      break
    }

    const docs = objects.map(transformPackage).filter((d) => d.name)
    console.log(`  Fetched ${docs.length} packages. Pushing to MeiliSearch...`)

    try {
      const result = await pushDocuments(docs)
      console.log(`  Queued task uid=${result.taskUid}`)
      totalIndexed += docs.length
      console.log(`  Total indexed so far: ${totalIndexed}`)
    } catch (err) {
      console.error(`  Error pushing documents: ${err.message}`)
    }

    if (page < pages - 1) {
      console.log(`  Waiting ${DELAY_MS}ms before next page...`)
      await sleep(DELAY_MS)
    }
  }

  console.log(`\nDone! Indexed ${totalIndexed} packages into MeiliSearch.`)
  console.log('Run "docker exec -it <meili-container> curl http://localhost:7700/indexes/packages/stats" to verify.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
