const express = require('express');
const fs = require('fs');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(express.json());

// Initialize OpenAI API
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post('/merge-changes', (req, res) => {
    const updatedContent = req.body.content;
    fs.writeFile(path.join(__dirname, '../index.html'), updatedContent, (err) => {
        if (err) {
            console.error('Error writing to index.html:', err);
            return res.status(500).send('Failed to merge changes.');
        }
        res.send('Changes merged successfully!');
    });
});

app.post('/gpt-edit', async (req, res) => {
    const request = req.body.request;
    const prompt = `
        You are an expert in coding, specializing in optimal modular coding and sustainable practices. 
        Your task is to review the following code and make only the necessary edits to fix issues and optimize the code. 
        Ensure that your changes are sustainable, maintainable, and follow best practices. 
        If necessary, you may suggest or invoke other tools and agents to achieve the best results.
        Here is the code to review and edit:
        
        ${request}
        
        Please provide the updated code below:
    `;
    try {
        const gptResponse = await openai.createCompletion({
            model: 'gpt-4o-mini-2024-07-18', // or another model of your choice
            prompt: prompt,
            max_tokens: 8400,
        });
        const updatedContent = gptResponse.data.choices[0].text;

        // Check for suggestions to invoke other tools or agents
        if (updatedContent.includes('INVOKE_TOOL:')) {
            const toolName = updatedContent.match(/INVOKE_TOOL:\s*(\w+)/)[1];
            const toolResponse = await invokeTool(toolName, request);
            res.send(toolResponse);
        } else {
            res.send(updatedContent);
        }
    } catch (error) {
        console.error('Error processing GPT request:', error);
        res.status(500).send('Failed to process GPT request.');
    }
});

// Function to invoke other tools or agents
async function invokeTool(toolName, request) {
    // Example: Call another API or service based on the toolName
    if (toolName === 'LintingTool') {
        // Call a linting tool API
        const lintingResponse = await axios.post('http://linting-tool-api.com/lint', { code: request });
        return lintingResponse.data;
    } else if (toolName === 'OptimizationTool') {
        // Call an optimization tool API
        const optimizationResponse = await axios.post('http://optimization-tool-api.com/optimize', { code: request });
        return optimizationResponse.data;
    } else if (toolName === 'Clive') {
        // Call Clive API
        const cliveResponse = await axios.post('https://api.clive.com/execute', {
            apiKey: process.env.CLIVE_API_KEY,
            code: request
        });
        return cliveResponse.data;
    } else {
        return 'Unknown tool requested.';
    }
}

app.listen(3000, () => {
    console.log('Server running on port 3000');
});