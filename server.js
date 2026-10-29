import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const app = express();
app.use(express.json());

// 1. Memory storage for Sessions & Error boundaries (Substitute with Redis/SQLite in prod)
const sessionsDb = new Map();
const LOCAL_LLM_URL = 'http://localhost:11434/api/chat'; // Ollama default
const MAX_RECOVERY_ATTEMPTS = 3;

// Initialize MCP Client
let mcpClient;
async function initMCP() {
  try {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'], // Example MCP server
    });
    
    mcpClient = new Client({
      name: "chatbot-orchestrator",
      version: "1.0.0"
    }, {
      capabilities: { tools: {} }
    });
    
    await mcpClient.connect(transport);
    console.log("🚀 MCP Client connected successfully.");
  } catch (err) {
    console.error("❌ Failed to initialize MCP Client. Retrying in 5s...", err);
    setTimeout(initMCP, 5000);
  }
}
initMCP();

// Helper: Safely fetch tools from MCP
async function getAvailableTools() {
  if (!mcpClient) return [];
  try {
    const response = await mcpClient.listTools();
    return response.tools || [];
  } catch (err) {
    console.warn("⚠️ Warning: Failed to list MCP tools:", err.message);
    return [];
  }
}

// 2. Chat API endpoint
app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) {
    return res.status(400).json({ error: "Missing sessionId or message" });
  }

  // Load Session Context
  if (!sessionsDb.has(sessionId)) {
    sessionsDb.set(sessionId, [
      { role: "system", content: "You are an assistant. You have access to local tools through the Model Context Protocol (MCP). Be helpful and execute tool calls exactly as desired." }
    ]);
  }
  const history = sessionsDb.get(sessionId);
  history.push({ role: "user", content: message });

  try {
    const finalResponse = await orchestrateChatFlow(history);
    history.push({ role: "assistant", content: finalResponse });
    sessionsDb.set(sessionId, history); // Persist updated history

    res.json({ response: finalResponse });
  } catch (error) {
    console.error(`🔴 Critical orchestration failure:`, error);
    res.status(500).json({ 
      error: "An unrecoverable failure occurred.", 
      details: error.message,
      sessionRecoveryPrompt: "System: Please try again or provide simpler instructions."
    });
  }
});

// 3. Orchestrator Loop with Auto-Recovery & MCP Execution
async function orchestrateChatFlow(history, attempts = 0) {
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    throw new Error(`Max retry loop limit of ${MAX_RECOVERY_ATTEMPTS} reached. Preventing infinite execution.`);
  }

  try {
    // Inject available tools into LLM format if the local model supports tool routing
    const availableTools = await getAvailableTools();
    const toolsPayload = availableTools.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, input_schema: t.inputSchema }
    }));

    // Call Local Model (e.g. llama3.1 / mistral via Ollama)
    const response = await fetch(LOCAL_LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1', // Ensure your local Ollama has this or change to your local target
        messages: history,
        tools: toolsPayload.length > 0 ? toolsPayload : undefined,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Local model returned unhealthy status: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.message;

    // Handle standard Message output
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content;
    }

    // Handing MCP tool requests
    console.log(`🤖 LLM requested tool execution:`, assistantMessage.tool_calls);
    history.push(assistantMessage); // Append assistant's request so trace remains intact

    for (const toolCall of assistantMessage.tool_calls) {
      const toolResult = await executeMCPToolWithRecovery(toolCall);
      history.push({
        role: "tool",
        name: toolCall.function.name,
        content: JSON.stringify(toolResult)
      });
    }

    // Loopback with new findings
    return await orchestrateChatFlow(history, attempts + 1);

  } catch (error) {
    console.warn(`⚠️ Error caught in orchestration layer (Attempt ${attempts + 1}):`, error.message);
    
    // Auto-recovery mechanism: inject systemic error advice back to the history or force LLM reset
    history.push({ 
      role: "system", 
      content: `[Recovery Alert] The previous tool or API call failed: ${error.message}. Please adjust your behavior, inform the user if you have no tools, or use fallback reasoning.` 
    });
    
    return await orchestrateChatFlow(history, attempts + 1);
  }
}

// Robust execution of the MCP tool with fallbacks
async function executeMCPToolWithRecovery(toolCall, retryCount = 0) {
  try {
    if (!mcpClient) throw new Error("MCP Client is disconnected");
    
    const result = await mcpClient.callTool({
      name: toolCall.function.name,
      arguments: toolCall.function.arguments || {}
    });
    return result;
  } catch (err) {
    console.error(`💥 Failed to execute tool "${toolCall.function.name}":`, err.message);
    
    if (retryCount < 2) {
      console.log(`♻️ Retrying tool call: ${toolCall.function.name} (${retryCount + 1})...`);
      return await executeMCPToolWithRecovery(toolCall, retryCount + 1);
    }
    
    // Fallback: return a error context object instead of throwing to avoid breaking the flow
    return { 
      error: true, 
      message: `Failed to execute: ${err.message}. Provide a graceful fallback to the user.` 
    };
  }
}

app.listen(3000, () => console.log('🟢 Server online at http://localhost:3000'));