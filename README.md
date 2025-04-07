# MCP Documentation Database Server

This project implements a Model Context Protocol (MCP) server designed to manage and query technical documentation stored in a MongoDB database.

## Scope and Intent

The primary goal of this server is to provide a backend service accessible via MCP for:

*   **Fetching Documentation:** Ingesting documentation content (expected in JSON format) from external URLs and storing it in a structured MongoDB collection.
*   **Querying Documentation:** Enabling text-based search across the stored documentation, leveraging MongoDB's text indexing capabilities.
*   **Aggregating Metadata:** Providing tools to aggregate data about the stored documentation (e.g., grouping by technology).
*   **Accessing Raw Content:** Retrieving specific documentation entries based on technology, version, or database ID.
*   **Exposing Schema:** Making the database schema discoverable via an MCP resource.

This server is intended to be used by AI clients (like language models) or other tools that understand MCP, allowing them to interact with a centralized documentation knowledge base.

## Features

*   **Tools:**
    *   `fetch-documentation`: Fetches and stores documentation from a URL.
    *   `query-documentation`: Performs text search on stored documents.
    *   `aggregate-documentation`: Aggregates document metadata (e.g., counts by technology).
*   **Resources:**
    *   `database.schema`: Provides the schema of the MongoDB collections.
    *   `documentation.content`: Retrieves specific documentation entries by technology/version or ID.
*   **Technology Stack:**
    *   Node.js with TypeScript
    *   MongoDB with Mongoose ODM
    *   `@modelcontextprotocol/sdk` for MCP implementation
    *   Zod for schema validation
    *   pnpm for package management

## Setup and Running

1.  Ensure MongoDB is running locally (default port 27017).
2.  Navigate to the project directory (`context_fetch_mcp_server`).
3.  Install dependencies: `pnpm install`
4.  Compile TypeScript: `pnpm build`
5.  Create the necessary text index in MongoDB:
    ```mongo
    use documentation_db;
    db.documentations.createIndex({ technology: "text", "content.title": "text", "content.description": "text" });
    ```
6.  Run the server: `node dist/index.js`

The server will connect via STDIO. Refer to `PROMPTS.md` for example client interactions.