import "dotenv/config"
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { MilvusClient, DataType, IndexType, MetricType } from "@zilliz/milvus2-sdk-node";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";

const COLLECTION = process.env.MILVUS_COLLECTION ?? "rag_docs";
const MILVUS_ADDRESS =
  process.env.MILVUS_URI?.replace(/^https?:\/\//, "") ?? "localhost:19530";

const client = new MilvusClient({ address: MILVUS_ADDRESS });

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDING_MODEL ?? "text-embedding-v3",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

async function loadChunks(dataDir = "./data") {
  if (!existsSync(dataDir)) {
    throw new Error(`数据目录不存在: ${dataDir}`);
  }
  const files = readdirSync(dataDir).filter((f) =>/\.(txt|md)$/i.test(f));
  if (files.length === 0) {
    throw new Error(`目录内无 .txt/.md 文件: ${dataDir}`);
  }

  const docs = files.map((f) => ({
    pageContent: readFileSync(join(dataDir, f), "utf-8"),
    metadata: { source: f },
  }));

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  return splitter.splitDocuments(docs);
}


async function  main() {
  try {
    await client.connectPromise

  const chunks = await loadChunks()

  const hasCollection = await client.hasCollection({
    collection_name: COLLECTION,
  });
  if (hasCollection.value) {
    await client.dropCollection({ collection_name: COLLECTION });
    console.log(`✓ 已删除集合 ${COLLECTION}`);
  }

  const vectors = await embeddings.embedDocuments(chunks.map((c) => c.pageContent));
  const dim = vectors[0].length;

  console.log('创建集合...');
  await client.createCollection({
    collection_name: COLLECTION,
    fields: [
      { name: 'langchain_primaryid', data_type: DataType.Int64, is_primary_key: true, autoID: true },
      { name: 'langchain_text', data_type: DataType.VarChar, max_length: 10000 },
      { name: 'source', data_type: DataType.VarChar, max_length: 256 },
      { name: "langchain_vector", data_type: DataType.FloatVector, dim },
    ],
  });

  console.log('创建向量索引...');
  await client.createIndex({
    collection_name: COLLECTION,
    field_name: "langchain_vector",
    index_type: IndexType.IVF_FLAT,
    metric_type: MetricType.L2,
    params: {nlist: 128 },
  });
  console.log('✓ 索引创建成功');

  await client.loadCollection({ collection_name: COLLECTION });
  console.log('✓ 集合已加载');

  console.log(`插入 ${chunks.length} 条...`);
  const data = chunks.map((chunk, i) => ({
    langchain_text: chunk.pageContent,
    langchain_vector: vectors[i],
    source: chunk.metadata.source,
  }));

  const result = await client.insert({
    collection_name: COLLECTION,
    data,
  });
  console.log(`✓ Milvus 写入完成: ${result.insert_cn}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main()