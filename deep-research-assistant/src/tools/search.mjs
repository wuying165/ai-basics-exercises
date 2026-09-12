import { tool } from "langchain";
import { z } from "zod"; 

function formatWebPages(webpages) {
  return webpages
    .map(
      (page, idx) =>`引用: ${idx + 1}
        标题: ${page.name}
        URL: ${page.url}
        摘要: ${page.summary}
        网站名称: ${page.siteName}
        网站图标: ${page.siteIcon}
        发布时间: ${page.dateLastCrawled}`,
    )
    .join("\n\n");
}

async function bochaWebSearch(query, count) {
  const apiKey = process.env.BOCHA_API_KEY
  if (!apiKey) {
    throw new Error('Bocha Web Search 的 API Key 未配置（环境变量 BOCHA_API_KEY）。')
  }
  
  const url = "https://api.bochaai.com/v1/web-search";

  const respose = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      freshness: "noLimit",
      summary: true,
      count: count ?? 10,
    })
  })

  if (!respose.ok) {
    const errorText = await respose.text().catch(() => "")
    throw new Error(`搜索 API 请求失败，状态码: ${response.status}, 错误信息: ${errorText}`)
  }

  let json
  try {
    json = await respose.json()
  } catch (error) {
    throw new Error(`搜索结果解析失败：${error.message}`)
  }

  if (json?.code !== 200 || !json?.data) {
    throw new Error(`搜索 API 返回失败：${json?.msg ?? "未知错误"}`)
  }

  const webpages = json.data.webPages?.value ?? []
  if (!webpages.length) {
    return "未找到相关结果。"
  }

  return formatWebPages(webpages);
}

export const webSearch = tool(async (input) => {
  const { query, count } = input
  console.log(`  🔎 搜索: ${input.query}（${count} 条）`);
  return await bochaWebSearch(query, count)
}, {
  name: 'web_search',
  description: '使用 Bocha 联网搜索 API 检索互联网网页。输入中文或中英结合的搜索关键词，可选 count 指定结果数量。返回标题、URL、摘要、网站名称、图标和发布时间。',
  schema: z.object({
    query: z.string().describe("要搜索的关键词"),
    count: z.number().optional().describe("返回的结果数量，默认 10 个"),
  }),
})