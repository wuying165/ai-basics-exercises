import "dotenv/config";
import { parse } from 'path'
import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';
import { OpenAIEmbeddings } from "@langchain/openai";
import { EPubLoader } from"@langchain/community/document_loaders/fs/epub";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

const COLLECTION_NAME = 'ebook_collection'
const VECTOR_DIM = 1024
const CHUNK_SIZE = 500
const EPUB_FILE = './天龙八部.epub';

const BOOK_NAME = parse(EPUB_FILE).name;

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDINGS_MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  },
  dimensions: VECTOR_DIM
})


const client = new MilvusClient({ address : 'localhost:19530' })

async function getEmbedding(text) {
  return await embeddings.embedQuery(text)
}

async function ensureCollection() {
  try {
    const hasCollection = await client.hasCollection({ collection_name: COLLECTION_NAME })
    if (!hasCollection.value) {
      await client.createCollection({
        collection_name: COLLECTION_NAME,
        fields: [
          { name: 'id', data_type: DataType.VarChar, max_length: 100, is_primary_key: true },
          { name: 'book_id', data_type: DataType.VarChar, max_length: 100 },
          { name: 'book_name', data_type: DataType.VarChar, max_length: 200 },
          { name: 'chapter_num', data_type: DataType.Int32 },
          { name: 'index', data_type: DataType.Int32 },
          { name: 'content', data_type: DataType.VarChar, max_length: 10000 },
          { name: 'vector', data_type: DataType.FloatVector, dim: VECTOR_DIM }
        ]
      })
    }

    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_type: IndexType.IVF_FLAT,
      metric_type: MetricType.COSINE,
      params: { nlist: 1024 }
    })


    try {
      await client.loadCollection({ collection_name: COLLECTION_NAME })
    } catch (error) {
      console.log('✓ 集合已处于加载状态');
    }

  } catch (error) {
    console.error('创建集合时出错:', error.message);
    throw error;
  }
}

async function insertChunksBatch(chunks, bookId, chapterNum) {
  try {
    const data = await Promise.all(chunks.map(async(chunk, chunkIndex) => ({
      id: `${bookId}_${chapterNum}_${chunkIndex}`,
      book_id: bookId,
      book_name: BOOK_NAME,
      chapter_num: chapterNum,
      index: chunkIndex,
      content: chunk,
      vector: await getEmbedding(chunk)
    })))

    const result = await client.insert({
      collection_name: COLLECTION_NAME,
      data,
    })

    return Number(result.insert_cnt) || 0;
  } catch (error) {
    console.error(`插入章节 ${chapterNum} 的数据时出错:`, error.message);
    console.error('错误详情:', error);
    throw error;
  }
}

async function loadAndProcessEPubStreaming(bookId) {
  try {
    const loader = new EPubLoader(EPUB_FILE, { splitChapters: true })

    const documents = await loader.load()
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: 50 })

    let totalInserted = 0;
    for (let chapterIndex = 0; chapterIndex < documents.length; chapterIndex++) {
      const chapter = documents[chapterIndex];
      const chunks = await textSplitter.splitText(chapter.pageContent)
      
      if (!chunks.length) continue

      const insertedCount = await insertChunksBatch(chunks, bookId, chapterIndex + 1)
      totalInserted += insertedCount;
      console.log(`  ✓ 已插入 ${insertedCount} 条记录（累计: ${totalInserted}）\n`);
    }

    console.log(`\n总共插入 ${totalInserted} 条记录\n`);
    return totalInserted;
  } catch (error) {
    console.error('加载 EPUB 文件时出错:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('Connecting to Milvus...');
    await client.connectPromise
    console.log('✓ Connected\n');

    const bookId = 1;

    // 确保集合存在
    await ensureCollection(bookId);

    await loadAndProcessEPubStreaming(bookId);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main()
