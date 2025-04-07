// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import mongoose from 'mongoose';

// Define MongoDB connection
// Ensure MongoDB server is running locally on the default port 27017
mongoose.connect('mongodb://localhost:27017/documentation_db')
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define schema for documentation
const DocSchema = new mongoose.Schema({
  technology: String,
  version: String,
  content: Object,
  tags: [String],
  lastUpdated: Date
});
// Ensure text index on relevant fields
DocSchema.index({
  technology: 'text',
  'content.title': 'text', // Index nested fields if they exist and are relevant
  'content.description': 'text' // Index nested fields if they exist and are relevant
});


const Documentation = mongoose.model('Documentation', DocSchema);

// Create MCP server
const server = new McpServer({
  name: 'Documentation Database Server',
  version: '1.0.0',
  capabilities: { // Explicitly define capabilities
      tools: {},
      resources: {}
  }
});

// Tool: Fetch documentation from external source
server.tool(
  'fetch-documentation',
  // Pass the raw shape object directly as the second argument
  {
      url: z.string().url(),
      technology: z.string(),
      version: z.string().optional()
  },
  async (args) => { // Callback receives 'args'
    const { url, technology, version } = args; // Destructure args
    try {
      console.log(`Fetching documentation from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.json();
      console.log(`Successfully fetched content for ${technology}`);

      // Store in MongoDB
      const doc = new Documentation({
        technology,
        version: version || 'latest',
        content,
        tags: [technology], // Initialize tags with the technology name
        lastUpdated: new Date()
      });

      await doc.save();
      console.log(`Documentation for ${technology} stored successfully.`);

      return {
        content: [{ type: 'text', text: `Documentation for ${technology} fetched and stored` }]
      };
    } catch (error: any) { // Explicitly type error
      console.error(`Error fetching/storing documentation: ${error.message}`);
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Tool: Query documentation
server.tool(
  'query-documentation',
  // Pass the raw shape object directly as the second argument
  {
      technology: z.string().optional(),
      query: z.string(),
      limit: z.number().int().positive().optional().default(10) // Ensure limit is positive integer, add default
  },
  async (args) => { // Callback receives 'args'
    const { technology, query, limit } = args; // Destructure args
    try {
      console.log(`Querying documentation: technology=${technology}, query=${query}, limit=${limit}`);
      // Build MongoDB query
      const filter: any = technology ? { technology } : {}; // Type filter explicitly

      // Use text search if MongoDB text index is set up
      // Note: A text index needs to be created on the 'Documentation' collection for this to work efficiently.
      // Example: db.documentations.createIndex({ technology: "text", "content.title": "text", "content.description": "text" })
      const docs = await Documentation.find(
        { ...filter, $text: { $search: query } },
        { score: { $meta: "textScore" } } // Project the text search score
      )
      .sort({ score: { $meta: "textScore" } }) // Sort by relevance
      .limit(limit);

      console.log(`Found ${docs.length} entries matching "${query}"`);

      // Return results (consider returning actual doc summaries or IDs)
      const resultsText = docs.map((doc, index) =>
          `${index + 1}. ${doc.technology} ${doc.version || ''}: ${JSON.stringify(doc.content).substring(0, 100)}... (Score: ${doc.get('score')})`
      ).join('\n');


      return {
        content: [{
          type: 'text',
          text: `Found ${docs.length} documentation entries matching "${query}":\n${resultsText || 'No specific content preview available.'}`
        }]
      };
    } catch (error: any) { // Explicitly type error
      console.error(`Error querying documentation: ${error.message}`);
      // Check for specific MongoDB errors (e.g., index not found)
      if (error.message.includes('text index required')) {
           return {
               content: [{ type: 'text', text: `Error: Text search requires a text index on the collection. Please create one.` }],
               isError: true
           };
      }
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);
// Tool: Aggregate documentation
server.tool(
  'aggregate-documentation',
  // Pass the raw shape object directly as the second argument
  {
      groupBy: z.string().describe('Field name to group by (e.g., technology, version)'), // Keep describe here as it's part of Zod schema
      filter: z.record(z.any()).optional().describe('Optional MongoDB filter object') // Keep describe here
  },
  async ({ groupBy, filter = {} }) => {
    try {
        console.log(`Aggregating documentation: groupBy=${groupBy}, filter=${JSON.stringify(filter)}`);
        // Basic validation for groupBy field to prevent arbitrary code execution if used directly in keys
        if (!/^[a-zA-Z0-9_.]+$/.test(groupBy)) {
             throw new Error('Invalid groupBy field name.');
        }

        const pipeline: mongoose.PipelineStage[] = [ // Add explicit type
          { $match: filter },
          { $group: { _id: `$${groupBy}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } } // Mongoose types should handle -1 correctly with PipelineStage[]
        ];

        const result = await Documentation.aggregate(pipeline);
        console.log(`Aggregation successful, found ${result.length} groups.`);

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }; // Return JSON as string
    } catch (error: any) {
        console.error(`Error aggregating documentation: ${error.message}`);
        return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true
        };
    }
  }
);


// Resource: Database schema
server.resource(
  'database.schema', // name
  'database.schema', // uri (static URI)
  async () => { // Callback takes no arguments for static URI
    // Handler logic remains the same...
    try {
        console.log('Fetching database schema...');
        if (!mongoose.connection.db) {
            throw new Error('Database connection not established.');
        }
        const collections = await mongoose.connection.db.listCollections().toArray();
        const schema: { [key: string]: string[] } = {};
        for (const collectionInfo of collections) {
            const name = collectionInfo.name;
            if (name.startsWith('system.')) continue;
            if (!mongoose.connection.db) {
               throw new Error('Database connection lost.');
            }
            const collection = mongoose.connection.db.collection(name);
            const sample = await collection.findOne({});
            schema[name] = sample ? Object.keys(sample) : ['_id'];
        }
        console.log('Database schema fetched successfully.');
        return { content: [{ type: 'json', json: schema }] };
    } catch (error: any) {
        console.error(`Error fetching database schema: ${error.message}`);
        return { content: [{ type: 'text', text: `Error fetching schema: ${error.message}` }], isError: true };
    }
  }
);


// Resource: Documentation content (Consolidated)
server.resource(
  'documentation.content', // name
  { // ResourceTemplate object - ONLY uriTemplate
    uriTemplate: 'documentation.content/{id?}/{technology?}/{version?}' // Define optional params in template
    // Removed 'schema' property based on error message
  },
  // Explicitly type params as 'any' for now to bypass implicit any error
  async (params: any) => {
      const { technology, version, id } = params || {}; // Destructure potentially undefined params
      // Handler logic remains the same...
      try {
          console.log(`Fetching documentation content: technology=${technology}, version=${version}, id=${id}`);
          const query: any = {};
          if (id) {
              if (!mongoose.Types.ObjectId.isValid(id)) { return { content: [{ type: 'text', text: `Error: Invalid ID format: ${id}` }], isError: true }; }
              query['_id'] = new mongoose.Types.ObjectId(id);
              const doc = await Documentation.findOne(query).lean();
              if (!doc) { return { content: [{ type: 'text', text: `Error: No documentation found with ID: ${id}` }], isError: true }; }
              const sanitizedDoc = { ...doc, _id: doc._id.toString() };
              return { content: [{ type: 'json', json: sanitizedDoc }] };
          } else {
              // Allow fetching by tech/version even if ID is not in URI template
              // Or adjust template to be more specific if needed e.g. 'docs/tech/{technology}/{version}'
              if (technology) query['technology'] = technology;
              if (version) query['version'] = version;
              // Only query if at least one filter is present
              if (technology || version) {
                  const docs = await Documentation.find(query).limit(10).lean();
                  const sanitizedDocs = docs.map(doc => ({ ...doc, _id: doc._id.toString() }));
                  return { content: [{ type: 'json', json: sanitizedDocs }] };
              } else {
                  // Handle case where no parameters are provided (optional)
                  // Maybe return empty or a general message
                   return { content: [{ type: 'text', text: 'Please provide technology/version or an ID.' }] };
              }
          }
      } catch (error: any) {
          console.error(`Error fetching documentation content: ${error.message}`);
          return { content: [{ type: 'text', text: `Error fetching content: ${error.message}` }], isError: true };
      }
  }
);


// Helper function for Fuzzy Search (using regex)
const fuzzySearch = async (term: string, field: string) => {
  // Basic sanitization of term to escape regex special characters
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedTerm.split('').join('.*'), 'i'); // Case-insensitive fuzzy match
  console.log(`Performing fuzzy search for term "${term}" in field "${field}" using regex: ${regex}`);
  try {
      const results = await Documentation.find({ [field]: regex }).limit(10).lean(); // Limit results
      console.log(`Fuzzy search found ${results.length} results.`);
      // Convert ObjectId to string for JSON serialization
      return results.map(doc => ({
          ...doc,
          _id: doc._id.toString()
      }));
  } catch (error: any) {
      console.error(`Error during fuzzy search: ${error.message}`);
      throw error; // Re-throw error to be handled by caller or tool wrapper
  }
};

// Example of how fuzzySearch could be integrated into a tool (Optional - Do not add this tool unless specifically requested later)
/*
server.tool(
  'fuzzy-query',
  {
    description: 'Performs a fuzzy search on a specified field.',
    inputSchema: z.object({
      term: z.string(),
      field: z.string().describe('Field to search within (e.g., technology, content.title)')
    })
  },
  async ({ term, field }) => {
    try {
      const results = await fuzzySearch(term, field);
      return { content: [{ type: 'json', json: results }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
);
*/

// Connect server to transport
const transport = new StdioServerTransport();
server.connect(transport);

console.log('MCP Documentation Server started via stdio');

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down server...');
  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
  // Optionally add server.close() if the SDK provides it
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down server...');
  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
  // Optionally add server.close() if the SDK provides it
  process.exit(0);
});