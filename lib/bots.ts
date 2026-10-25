// Bot list for robots.txt: [name, purpose, default allowed, always on]
export const BOTS: [string, string, boolean, boolean][] = [
 ["Googlebot","Google Search",true,true],["Bingbot","Bing and Copilot search",true,true],
 ["OAI-SearchBot","ChatGPT search results",true,false],["ChatGPT-User","ChatGPT visits a page for a user",true,false],
 ["PerplexityBot","Perplexity answers",true,false],["Claude-SearchBot","Claude search results",true,false],
 ["GPTBot","OpenAI model training",true,false],["ClaudeBot","Anthropic model training",true,false],
 ["Google-Extended","Gemini training and grounding opt-out token",true,false],["Applebot-Extended","Apple AI training opt-out token",true,false],["CCBot","Common Crawl dataset",false,false]
];
