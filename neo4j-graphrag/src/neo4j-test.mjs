import neo4j from "neo4j-driver"

const driver = neo4j.driver("bolt://localhost:7687", neo4j.auth.basic("neo4j", "12345678"))

const session = driver.session()

async function createData() {
  const result = await session.run(`
    CREATE (p:Product {name: "珍珠奶茶"})
    CREATE (i:Ingredient {name: "珍珠"})
`)
  console.log('创建成功')
}

async function createRelation() {
  await session.run(`
    MATCH (p:Product {name: "珍珠奶茶"}), (i:Ingredient {name: "珍珠"})
    CREATE (p)-[:包含]->(i)
    `)
    console.log('关系创建成功')
}

async function queryData() {
  const result = await session.run(`
    MATCH (p:Product {name: "珍珠奶茶"})-[r]->(i)
    RETURN p, r, i
  `)
  
  result.records.forEach(record => {
    console.log('奶茶:', record.get('p').properties.name)
    console.log('关系:', record.get('r').type)
    console.log('配料:', record.get('i').properties.name)
    console.log('--------------------------------')
  })
}

async function updateData() {
  await session.run(`
    MATCH (p:Product {name: "珍珠奶茶"})
    SET p.price = 15, p.calorie = "中高"
  `)
  console.log('数据更新成功')
}

async function deleteRelation() {
  await session.run(`
    MATCH (p:Product {name: "珍珠奶茶"})-[r:包含]->(i:Ingredient {name: "珍珠"})
    DELETE r
  `)
  console.log('关系删除成功')
}

async function deleteNode() {
  await session.run(`
    MATCH (p:Product {name: "珍珠奶茶"})
    DELETE p
  `)
  console.log('删除节点成功')
}

async function main() {
  try {
    // await createData()
    // await createRelation()
    await queryData()
    // await updateData()
    // await deleteRelation()
    // await deleteNode()
  } catch (error) {
    console.error('执行出错:', error)
  } finally {
    await session.close()
    await driver.close()
  }
}

main()