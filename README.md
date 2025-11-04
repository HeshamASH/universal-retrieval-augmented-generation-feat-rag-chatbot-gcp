<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18yhfDmamIhagPQejum_x4htzvm8Gq9JT

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


<pre><code>
.----------------.  .----------------.  .----------------.
| .--------------. || .--------------. || .--------------. |
| |      __      | || |     _____    | || |    ______    | |
| |     /  \     | || |    |_   _|   | || |  .' ____ '.  | |
| |    / /\ \    | || |      | |     | || |  | (____) |  | |
| |   / ____ \   | || |      | |     | || |  '_.____. |  | |
| | _/ /    \ \_ | || |     _| |_    | || |  | (____)| |  | |
| ||____|  |____|| || |    |_____|   | || |   \______.'  | |
| |              | || |              | || |              | |
| '--------------' || '--------------' || '--------------' |
 '----------------'  '----------------'  '----------------'
</code></pre>

# AI Social Content Suite

An advanced, all-in-one application designed to streamline your social media workflow using the power of Google's Gemini AI. Generate, refine, and analyze content for multiple platforms from a single idea.

---

## ✨ Key Features

This application is more than just a content generator; it's a comprehensive toolset for the modern social media manager.

-   **Multi-Platform Generation:** Input a single idea and get tailored posts for LinkedIn (professional), Twitter/X (punchy), and Instagram (visual-focused), all generated simultaneously.
-   **Platform-Optimized Images:** Automatically generates unique, high-quality images for each post, perfectly sized with the optimal aspect ratio for each network (1:1, 16:9, 3:4).
-   **Two-Agent Image Refinement:** An optional advanced workflow where a second AI "Art Director" agent (`gemini-2.5-pro`) analyzes the initial image and provides precise feedback to an editing AI (`gemini-2.5-flash-image`) for automated improvements, ensuring top-tier visual quality.
-   **Interactive AI Editing:**
    -   **Image Editor:** Modify any generated image with simple text prompts. Type "add a retro filter" or "make the colors more vibrant," and the AI will regenerate the image accordingly.
    -   **Text Editor:** Refine any generated text with AI assistance. Ask it to "make this more witty" or "add a call to action," and get instant revisions.
-   **Search Grounding:** Keep your content relevant and timely. An optional toggle uses Google Search to ground the AI's text generation in the latest information, perfect for posts about current events.
-   **Image Analyzer:** Upload your own images and use Gemini's multimodal capabilities to understand them. Ask questions, get descriptions, identify objects, and more.
-   **Save & Copy:** Easily save your generated images and copy the post text to your clipboard with one-click buttons.

---

## 🚀 How to Use

1.  **Enter Idea:** Start by typing your core content idea into the main text area.
2.  **Select Tone:** Choose the desired tone for your posts (e.g., Professional, Witty, Urgent).
3.  **Choose Advanced Options (Optional):**
    -   Toggle **"Use Latest Info"** to ground the text in recent Google Search results.
    -   Toggle **"Advanced Image Refinement"** to enable the two-agent image analysis workflow for higher quality (note: this is slower).
4.  **Generate:** Click the "Generate Content" button. The app will create posts for LinkedIn, Twitter/X, and Instagram.
5.  **Review & Refine:**
    -   Use the "✏️ Edit Image" and "✏️ Edit Text with AI" buttons to make AI-powered adjustments.
    -   Use the "💾 Save Image" and "Copy Text" buttons to export your final content.
6.  **Analyze (Separate Tool):**
    -   Scroll down to the "Analyze an Image" section.
    -   Upload an image file and type a question or prompt about it.
    -   Click "Analyze Image" to get insights from the AI.

---

## 🛠️ Technology Stack

-   **Frontend:** React, TypeScript, Tailwind CSS
-   **AI Engine:** Google Gemini API
-   **Core Models Used:**
    -   `gemini-2.5-pro`: For complex text generation and advanced image analysis.
    -   `gemini-2.5-flash`: For standard text generation, AI text editing, and image analysis.
    -   `imagen-4.0-generate-001`: For high-quality base image generation.
    -   `gemini-2.5-flash-image`: For powerful, prompt-based image editing.
-   **Tooling:** Vite, Esbuild

---

## ☁️ Cloud Run Services (Proposed Architecture)

This application is currently designed as a pure client-side application, with all logic running directly in the user's browser. This architecture simplifies deployment (can be hosted on any static site provider) and requires no backend infrastructure. The Gemini API key is managed by the hosting environment (e.g., AI Studio).

For a production-grade, scalable application, a backend service is recommended to manage API keys securely and handle business logic. Here’s a proposed architecture using Google Cloud Run:

-   **Frontend Service (Cloud Run):** The React application would be containerized (e.g., using Docker with a Node.js server like Express to serve the static files) and deployed as a Cloud Run service. This provides a scalable, serverless frontend.
-   **Backend API Service (Cloud Run):** A second Cloud Run service (e.g., written in Node.js, Python, or Go) would act as a backend-for-frontend (BFF).
    -   It would securely store the Google AI API key using Secret Manager.
    -   The frontend would make requests to this backend service instead of calling the Gemini API directly.
    -   The backend would then call the Gemini API, process the results, and return them to the frontend.
    -   This architecture prevents exposing the API key to the client and allows for caching, rate limiting, and more complex logic on the server side.

**Architecture Diagram (Proposed):**

```
[User's Browser] <--> [Frontend React App (Cloud Run)] <--> [Backend API (Cloud Run)] <--> [Google Gemini API]
                                                                        ^
                                                                        |
                                                                [Google Secret Manager (for API Key)]
```

---

## 🤖 AI Studio Category (Prompts Used)

Here are the core prompts used within the application to instruct the Gemini models.

### 1. Social Post Text Generation

This prompt is sent to `gemini-2.5-pro` to generate the text content for all three social platforms in a single, structured JSON response.

```
You are an expert social media manager. Based on the following idea and desired tone, generate social media posts for LinkedIn, Twitter/X, and Instagram.

**Idea:** ${idea}
**Tone:** ${tone}

**Instructions:**
1.  **LinkedIn:** Write a professional, slightly longer post. Use professional language and structure it for engagement (e.g., ask a question at the end).
2.  **Twitter/X:** Write a short, punchy tweet (well under 280 characters). Use 2-3 relevant hashtags and a strong, concise message.
3.  **Instagram:** Write a visually-focused caption. Start with a hook, provide some value or tell a short story, and include a set of 5-7 relevant, popular hashtags.

Return ONLY a valid JSON object with the keys "linkedin", "twitter", and "instagram". Do not include any other text or markdown formatting like ```json.
```

### 2. Base Image Generation

This prompt is sent to `imagen-4.0-generate-001` to create the initial images.

```
Create a vibrant, high-quality, cinematic photograph representing the concept of: '${idea}'. The mood should be ${tone}. Focus on photorealism and dynamic lighting.
```

### 3. AI Art Director Analysis (Advanced Refinement)

For the "Advanced Image Refinement" feature, this prompt is sent to `gemini-2.5-pro` to analyze the base image and suggest an edit.

```
You are a world-class art director. You are given an image that was generated based on the following prompt: '${originalPrompt}'. Your task is to analyze the image for quality, accuracy, and aesthetic appeal. Provide a concise, actionable instruction for an image editing AI to improve it. The instruction should be a direct command, like 'Add a subtle lens flare in the top left corner' or 'Make the person's smile more genuine'. If the image is already excellent and needs no changes, respond with the exact word 'PERFECT'. Do not add any other explanations or pleasantries. Just the editing command or 'PERFECT'.
```

### 4. AI-Powered Text Editing

When a user requests an edit to the generated text, this prompt is sent to `gemini-2.5-flash`.

```
You are an expert copy editor. You are given the following text and an instruction to edit it.
Rewrite the text to fulfill the instruction precisely.

**Original Text:**
"${originalText}"

**Instruction:**
"${editPrompt}"

Return ONLY the rewritten text. Do not add any introductory phrases, explanations, or markdown formatting. Just the final, edited text.
```
