import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: 'http://localhost:9200'
})

const INDEX_NAME = 'travel_journal'

async function createDocument() {
  const now = new Date().toISOString()
  const res = await client.index({
    index: INDEX_NAME,
    document: {
      note_title: '夜跑复盘',
      note_body: '今天夜跑 5 公里，配速稳定，结束后做了拉伸。',
      tags: ['运动', '夜跑'],
      mood: 'focused',
      priority: 2,
      created_at: now,
      updated_at: now
    },
    refresh: true,
  })

  console.log('✅ 新增成功，ID =', res._id);
  return res._id
}

async function getDocument(id) {
  const res = await client.get({ index: INDEX_NAME, id })
  console.log('📖 查询结果:', res._source);
}

async function updateDocument(id) {
  await client.update({ 
    index: INDEX_NAME, 
    id, 
    doc: {
      note_body: '今天夜跑 6 公里，状态不错，拉伸后恢复很快。',
      tags: ['运动', '夜跑', '训练'],
      updated_at: new Date().toISOString()
    },
    refresh: true,
  })
  console.log('🔄 更新成功');
}

async function searchDocuments() {
  const res = await client.search({
    index: INDEX_NAME,
    query: { match: { note_body: { query: '夜跑 训练', analyzer: 'ik_smart' } }}
  })

  const rows = res.hits.hits.map((item) => ({ ...item._source, id: item._id }))
  console.log('🔍 搜索结果:', rows);
}

async function deleteDocument(id) {
  await client.delete({ index: INDEX_NAME, id, refresh: true })
  console.log('🗑️ 删除成功');
}

async function run() {
  // const id = await createDocument()
  // await getDocument(id)
  // await updateDocument(id)
  // await searchDocuments()
  await deleteDocument('G-bSAZ4Bncizp0mR2lss')
}

run()