import "dotenv/config"
import { BaseDocumentCompressor } from "@langchain/core/retrievers/document_compressors"

export class DashScopeRerank extends BaseDocumentCompressor {
  constructor({ apiKey, baseUrl, model = "qwen3-rerank", topN = 3 }) {
    super()
    this.apiKey = apiKey
    this.model = model
    this.topN = topN
    this.baseUrl = baseUrl ?? process.env.RERANK_URL
  }

  async compressDocuments(documents, query) {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: { query, documents: documents.map((d) => d.pageContent) },
        parameters: { topN: this.topN, return_documents: true }
      })
    })

    const json = await res.json()

    const results = json?.output?.results || []
    return results.map((item) => documents[item.index]);
  } 
}