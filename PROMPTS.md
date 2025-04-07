# Effective Prompts for MCP Client Interaction

To help AI clients effectively use our MCP server, we should provide prompt templates:

## 1. Database Schema Discovery Prompt

You are connected to a documentation database through MCP. Before querying, let's examine the database schema:
1. Use the resource "database.schema" to understand available collections and fields.
2. Based on the schema, formulate your query using the appropriate collection and fields.

For example:
- To see the database schema: `{{getResource("database.schema")}}`
- To query MongoDB documentation: `{{useTool("query-documentation", {"technology": "MongoDB", "query": "aggregation pipeline"})}}`

## 2. Documentation Fetching Prompt

To fetch new documentation into the database:
1. Identify the technology name and version (optional).
2. Find a valid JSON documentation URL.
3. Use the `fetch-documentation` tool with these parameters.

Example:
`{{useTool("fetch-documentation", { "url": "https://api.example.com/docs/typescript/latest.json", "technology": "TypeScript", "version": "5.0" })}}`

## 3. Complex Query Prompt

When you need specific information from the documentation database:
1. First check what technologies are available: `{{useTool("aggregate-documentation", {"groupBy": "technology"})}}`
2. Then query for specific content using text search: `{{useTool("query-documentation", {"technology": "MongoDB", "query": "indexing strategies", "limit": 5})}}`
3. For detailed information on specific entries (if you know the technology/version or ID):
    - By technology/version: `{{getResource("documentation.content", {"technology": "MongoDB", "version": "latest"})}}`
    - By ID: `{{getResource("documentation.content", {"id": "DOCUMENT_ID"})}}`