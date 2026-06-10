import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client lazily to avoid crashing on start if environment variables are empty
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

// Ensure helpful error if API key is missing
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && !process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY environment variable is not defined - server will fallback to robust procedural generations.");
  }
  next();
});

// Helper for procedural offline level generation (fallback)
function generateProceduralLevel(theme: string, difficulty: string, lengthInTiles: number) {
  const platforms: any[] = [];
  const enemies: any[] = [];
  const collectibles: any[] = [];
  const powerups: any[] = [];
  
  const widthPerTile = 32;
  const levelEndX = lengthInTiles * widthPerTile;
  
  // 1. Add ground platforms with randomized gaps
  let currentX = 0;
  let pId = 1;
  let eId = 1;
  let cId = 1;
  let pwId = 1;
  
  // Starter safe platform
  platforms.push({
    id: `p_start`,
    x: 0,
    y: 450,
    width: 400,
    height: 150,
    behavior: "static"
  });
  currentX = 400;

  while (currentX < levelEndX - 500) {
    const gap = Math.floor(Math.random() * 80) + (difficulty === 'hard' ? 120 : 60);
    currentX += gap;
    
    const platWidth = Math.floor(Math.random() * 200) + 150;
    const platHeight = 40;
    const platY = 320 + Math.floor(Math.random() * 140); // 320 to 460 height
    
    // Moving or falling platform?
    let behavior: 'static' | 'moving' | 'falling' = 'static';
    const roll = Math.random();
    if (roll < 0.25) {
      behavior = 'moving';
    } else if (roll < 0.4 && difficulty !== 'easy') {
      behavior = 'falling';
    }
    
    platforms.push({
      id: `p_${pId++}`,
      x: currentX,
      y: platY,
      width: platWidth,
      height: platHeight,
      behavior: behavior
    });

    // Add some floaters above for visual depth / secrets
    if (Math.random() < 0.4) {
      platforms.push({
        id: `p_floater_${pId++}`,
        x: currentX + platWidth / 4,
        y: platY - 120,
        width: 100,
        height: 25,
        behavior: 'static'
      });
      
      // Collectible/powerup on floater
      if (Math.random() < 0.5) {
        collectibles.push({
          id: `c_${cId++}`,
          x: currentX + platWidth / 4 + 40,
          y: platY - 150,
          width: 25,
          height: 25,
          type: 'gem',
          collected: false,
          value: 10
        });
      } else {
        powerups.push({
          id: `pw_${pwId++}`,
          x: currentX + platWidth / 4 + 40,
          y: platY - 150,
          width: 30,
          height: 30,
          type: Math.random() < 0.3 ? 'shield' : Math.random() < 0.6 ? 'speed' : 'magnet',
          collected: false
        });
      }
    }

    // Add normal collectibles on platform
    const coinCount = Math.floor(platWidth / 60);
    for (let i = 0; i < coinCount; i++) {
      collectibles.push({
        id: `c_${cId++}`,
        x: currentX + 30 + i * 50,
        y: platY - 30,
        width: 20,
        height: 20,
        type: 'coin',
        collected: false,
        value: 1
      });
    }

    // Add enemies on platform
    if (platWidth > 150 && Math.random() < (difficulty === 'hard' ? 0.7 : 0.4)) {
      const type = Math.random() < 0.5 ? 'walker' : Math.random() < 0.8 ? 'jumper' : 'flyer';
      enemies.push({
        id: `e_${eId++}`,
        x: currentX + platWidth / 2,
        y: type === 'flyer' ? platY - 100 : platY - 40,
        width: 32,
        height: 32,
        type: type,
        health: difficulty === 'hard' ? 3 : 1,
        maxHealth: difficulty === 'hard' ? 3 : 1,
        speed: difficulty === 'hard' ? 2 : 1.2,
        patrolRange: Math.min(platWidth / 2 - 20, 150),
        startX: currentX + platWidth / 2,
        startY: type === 'flyer' ? platY - 100 : platY - 40,
        direction: Math.random() < 0.5 ? 1 : -1
      });
    }

    currentX += platWidth;
  }

  // End Boss or Gateway Zone
  const bossAreaX = levelEndX - 500;
  platforms.push({
    id: `p_boss`,
    x: bossAreaX,
    y: 450,
    width: 500,
    height: 150,
    behavior: "static"
  });

  // Collectibles at end chest
  collectibles.push({
    id: `c_chest`,
    x: bossAreaX + 180,
    y: 410,
    width: 40,
    height: 40,
    type: 'chest',
    collected: false,
    value: 50
  });

  // Power Star
  collectibles.push({
    id: `c_star`,
    x: bossAreaX + 350,
    y: 350,
    width: 32,
    height: 32,
    type: 'star',
    collected: false,
    value: 100
  });

  // Checkpoint at midpoint
  const midX = Math.floor(levelEndX / 2);
  const midPlat = platforms.find(p => p.x >= midX) || platforms[Math.floor(platforms.length / 2)];

  return {
    theme: theme as any,
    difficulty: difficulty as any,
    length: lengthInTiles,
    platforms,
    enemies,
    collectibles,
    powerups,
    checkpoint: { x: midPlat.x + 30, y: midPlat.y - 40 },
    goal: { x: bossAreaX + 440, y: 370, width: 40, height: 80 }
  };
}

// ---------------------------------------------------------
// ROUTE: Generate custom Level using Gemini Flash JSON Schema
// ---------------------------------------------------------
app.post("/api/generate-level", async (req, res) => {
  const { theme, difficulty, length } = req.body;
  const themeVal = theme || "forest";
  const diffVal = difficulty || "medium";
  const countTiles = length === "long" ? 220 : length === "short" ? 90 : 150;
  const maxPixelsWidth = countTiles * 32;

  const ai = getAiClient();
  if (!ai) {
    console.log("No API key. Returning procedural Fallback Level.");
    const customLevel = generateProceduralLevel(themeVal, diffVal, countTiles);
    return res.json(customLevel);
  }

  try {
    const prompt = `Generate a fully coherent, playable, and fun 2D retro mobile-vibe platformer level inside a JSON file.
    
    CRITICAL COORDINATE CONSTRAINTS:
    - Screen height is 600px. Standard Y positions for platforms should range from 280 to 480 so the player can jump between them easily and doesn't fall off-screen.
    - Platforms must cover x of 0 to ${maxPixelsWidth} px. Keep start safe (ground at x = 0 to 400).
    - Max gap between horizontally sequential platforms should be: 80px (for easy), 120px (for medium), and 170px (for hard).
    - Output MUST be 100% stable matching the precise JSON schema.
    
    Level Settings:
    - Theme: ${themeVal}
    - Difficulty: ${diffVal}
    - Level Length: ${countTiles} tiles (${maxPixelsWidth}px total length)

    Output must follow schema:
    {
      "platforms": array of Platforms,
      "enemies": array of Enemies,
      "collectibles": array of Collectibles,
      "powerups": array of Powerups,
      "checkpoint": { "x": number, "y": number },
      "goal": { "x": number, "y": number, "width": number, "height": number }
    }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["platforms", "enemies", "collectibles", "powerups", "checkpoint", "goal"],
          properties: {
            platforms: {
              type: Type.ARRAY,
              description: "Array of ground structural platforms",
              items: {
                type: Type.OBJECT,
                required: ["id", "x", "y", "width", "height", "behavior"],
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER },
                  width: { type: Type.INTEGER },
                  height: { type: Type.INTEGER },
                  behavior: { type: Type.STRING, description: "static, moving, or falling" }
                }
              }
            },
            enemies: {
              type: Type.ARRAY,
              description: "Enemy patrolling objects",
              items: {
                type: Type.OBJECT,
                required: ["id", "x", "y", "width", "height", "type", "health", "maxHealth", "speed", "patrolRange", "startX", "startY", "direction"],
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  type: { type: Type.STRING, description: "walker, flyer, jumper, or boss" },
                  health: { type: Type.NUMBER },
                  maxHealth: { type: Type.NUMBER },
                  speed: { type: Type.NUMBER },
                  patrolRange: { type: Type.NUMBER },
                  startX: { type: Type.NUMBER },
                  startY: { type: Type.NUMBER },
                  direction: { type: Type.NUMBER }
                }
              }
            },
            collectibles: {
              type: Type.ARRAY,
              description: "Coins or gems scattered around platforms",
              items: {
                type: Type.OBJECT,
                required: ["id", "x", "y", "width", "height", "type", "collected", "value"],
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  type: { type: Type.STRING, description: "coin, gem, star, or chest" },
                  collected: { type: Type.BOOLEAN },
                  value: { type: Type.NUMBER }
                }
              }
            },
            powerups: {
              type: Type.ARRAY,
              description: "Powerup floating crates",
              items: {
                type: Type.OBJECT,
                required: ["id", "x", "y", "width", "height", "type", "collected"],
                properties: {
                  id: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  width: { type: Type.NUMBER },
                  height: { type: Type.NUMBER },
                  type: { type: Type.STRING, description: "shield, speed, magnet, double_jump, or invincibility" },
                  collected: { type: Type.BOOLEAN }
                }
              }
            },
            checkpoint: {
              type: Type.OBJECT,
              required: ["x", "y"],
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              }
            },
            goal: {
              type: Type.OBJECT,
              required: ["x", "y", "width", "height"],
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                width: { type: Type.NUMBER },
                height: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    });

    const levelDataStr = response.text?.trim() || "";
    const levelDataJson = JSON.parse(levelDataStr);
    
    // Auto populate basic values to prevent any visual bugs
    levelDataJson.theme = themeVal;
    levelDataJson.difficulty = diffVal;
    levelDataJson.length = countTiles;
    
    // Always insert a secure base platform at start to protect first spawning frames
    if (!levelDataJson.platforms.some((p: any) => p.x === 0)) {
      levelDataJson.platforms.unshift({
        id: "p_spawn_shield",
        x: 0,
        y: 450,
        width: 400,
        height: 150,
        behavior: "static"
      });
    }

    res.json(levelDataJson);
  } catch (error) {
    console.error("Gemini failed to generate level layout: ", error);
    // Graceful automatic backup generator
    const backup = generateProceduralLevel(themeVal, diffVal, countTiles);
    res.json(backup);
  }
});

// ---------------------------------------------------------
// ROUTE: Generate Quest
// ---------------------------------------------------------
app.post("/api/generate-quest", async (req, res) => {
  const ai = getAiClient();
  const fallbackQuests = [
    {
      id: "q_coins",
      title: "Gold Rush 2012",
      description: "Collect 40 coins in single run without losing all hearts.",
      rewardCoins: 150,
      targetCount: 40,
      currentCount: 0,
      type: "collect_coins",
      completed: false
    },
    {
      id: "q_slayer",
      title: "Arcade Hunter",
      description: "Defeat 8 patrolling pixel monsters on your quest.",
      rewardCoins: 200,
      targetCount: 8,
      currentCount: 0,
      type: "defeat_enemies",
      completed: false
    },
    {
      id: "q_gems",
      title: "Treasure Collector",
      description: "Amass 3 rare world gems tucked in hidden sections.",
      rewardCoins: 250,
      targetCount: 3,
      currentCount: 0,
      type: "collect_gems",
      completed: false
    }
  ];

  if (!ai) {
    return res.json(fallbackQuests[Math.floor(Math.random() * fallbackQuests.length)]);
  }

  try {
    const prompt = `Generate a creative quest for a 2012 retro-vibe platformer.
    Must be challenging but satisfying. Output JSON-only following this schema:
    {
      "id": "q_" + unique_random_id,
      "title": string (engaging, catchy title),
      "description": string (clear instructions like 'Collect 15 coins without dying' or 'Defeat 5 flyers'),
      "rewardCoins": number (between 100 and 300),
      "targetCount": number (objective amount, e.g. 15),
      "currentCount": 0,
      "type": "collect_coins" or "defeat_enemies" or "collect_gems" or "no_damage_clear",
      "completed": false
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["id", "title", "description", "rewardCoins", "targetCount", "currentCount", "type", "completed"],
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            rewardCoins: { type: Type.NUMBER },
            targetCount: { type: Type.NUMBER },
            currentCount: { type: Type.NUMBER },
            type: { type: Type.STRING },
            completed: { type: Type.BOOLEAN }
          }
        }
      }
    });

    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (error) {
    res.json(fallbackQuests[Math.floor(Math.random() * fallbackQuests.length)]);
  }
});

// ---------------------------------------------------------
// ROUTE: Generate NPC Dialogues
// ---------------------------------------------------------
app.post("/api/generate-npc", async (req, res) => {
  const { name, world, personality } = req.body;
  const ai = getAiClient();

  const fallbackDialogue = {
    greeting: "Greetings young traveler! Adventure awaits!",
    hint: `Beware! The scary creatures guard the precious chest hidden inside ${world || "these woods"}!`,
    farewell: "Stay safe, may the pixel stars align!"
  };

  if (!ai) {
    return res.json(fallbackDialogue);
  }

  try {
    const prompt = `Generate RPG platformer dialogue for the following NPC:
    - Name: ${name || "Pixel Mage"}
    - Personality: ${personality || "Funny & Wise"}
    - Environment/World Theme: ${world || "Forest Grasslands"}

    Provide three distinct phrases, max 30 words each:
    1. Greeting
    2. Hint (giving advice regarding finding stars, using dash, or power-ups in the levels)
    3. Farewell
    
    Format output strictly in JSON matches:
    { "greeting": string, "hint": string, "farewell": string }`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["greeting", "hint", "farewell"],
          properties: {
            greeting: { type: Type.STRING },
            hint: { type: Type.STRING },
            farewell: { type: Type.STRING }
          }
        }
      }
    });

    res.json(JSON.parse(response.text?.trim() || "{}"));
  } catch (error) {
    res.json(fallbackDialogue);
  }
});

// ---------------------------------------------------------
// ROUTE: Daily Challenge (Deterministic based on current date)
// ---------------------------------------------------------
app.get("/api/daily-challenge", (req, res) => {
  const dateStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  // Simple hashing of the current date for a stable daily generation seed
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const themesAndPaths: ('forest' | 'desert' | 'ice' | 'volcano' | 'sky')[] = ['forest', 'desert', 'ice', 'volcano', 'sky'];
  const dailyTheme = themesAndPaths[Math.abs(hash) % themesAndPaths.length];
  const difficulty = Math.abs(hash) % 3 === 0 ? 'easy' : Math.abs(hash) % 3 === 1 ? 'medium' : 'hard';
  
  // Generating a lovely, structured daily layout
  const level = generateProceduralLevel(dailyTheme, difficulty, 160);
  res.json({
    date: dateStr,
    seed: hash,
    level
  });
});

// ---------------------------------------------------------
// Integrate Vite to make sure client assets are served correctly
// ---------------------------------------------------------
import { createServer as createViteServer } from "vite";

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server boot successful on port ${PORT}`);
  });
}

startServer();
