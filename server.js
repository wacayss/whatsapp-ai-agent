// server.js
// AI Agent oo ka jawaaba fariimaha WhatsApp ee macaamiisha dukaanka e-commerce
// Isticmaalaya: WhatsApp Cloud API (Meta) + Claude API (Anthropic)

import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";
import { getOrderStatus, getProductCatalog } from "./orders.js";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Xasuusta wadahadalka qof kasta (memory-ka - production waxaad isticmaali doontaa Redis/DB)
const conversations = new Map();

const SYSTEM_PROMPT = `Waxaad tahay agent taageero macmiil oo AI ah oo u shaqeeya dukaan online ah (e-commerce).
Waxaad ku jawaabaysaa fariimaha macaamiisha via WhatsApp.

Qawaaniinta:
- Ku jawaab luqadda uu macmiilku ku qoray (Af-Soomaali ama Ingiriisi).
- Noqo mid gaaban, saafi ah, oo raxmad leh.
- Haddii macmiilku weydiiyo xaaladda dalabkiisa, isticmaal tool-ka "check_order_status" adigoo isticmaalaya lambarka dalabka uu kuu soo diray.
- Haddii aadan hubin xogta ama su'aashu adag tahay (tusaale: dib-u-celin lacag, cabasho weyn), sheeg in aad la xiriiri doonto bini-aadam (human agent) oo aan is-yeelin xog aadan hubin.
- Ha bixin macluumaad aan sax ahayn oo ku saabsan qiimaha ama available-ka alaabta - isticmaal tool-ka product catalog haddii loo baahdo.
- Ka fogow inaad noqoto mid dhib badan ama celceliya hal jawaab isla mid ah.`;

const TOOLS = [
  {
    name: "check_order_status",
    description: "Hel xaaladda hadda ee dalab gaar ah, adigoo isticmaalaya lambarka dalabka.",
    input_schema: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Lambarka dalabka, tusaale '1001'" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "get_product_catalog",
    description: "Hel liiska alaabta la heli karo iyo qiimahooda.",
    input_schema: { type: "object", properties: {} },
  },
];

function runTool(name, input) {
  if (name === "check_order_status") return getOrderStatus(input.order_id);
  if (name === "get_product_catalog") return getProductCatalog();
  return { error: "Tool aan la aqoon" };
}

async function generateReply(userPhone, userMessage) {
  const history = conversations.get(userPhone) || [];
  history.push({ role: "user", content: userMessage });

  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    tools: TOOLS,
    messages: history,
  });

  // Maaree tool calls haddii Claude u baahdo xog dheeraad ah
  while (response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find((b) => b.type === "tool_use");
    const toolResult = runTool(toolUseBlock.name, toolUseBlock.input);

    history.push({ role: "assistant", content: response.content });
    history.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult),
        },
      ],
    });

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: history,
    });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const replyText = textBlock ? textBlock.text : "Waan ka xumahay, wax khalad ah ayaa dhacay.";

  history.push({ role: "assistant", content: replyText });
  // Ku hay ugu badnaan 20 fariin si aan memory-ka u buuxin
  conversations.set(userPhone, history.slice(-20));

  return replyText;
}

async function sendWhatsAppMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

// Meta waxay u isticmaashaa GET si ay u xaqiijiso webhook-ka markaad dhistid
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Halkan ayaa fariimaha WhatsApp ku soo gala
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (message && message.type === "text") {
      const from = message.from; // lambarka macmiilka
      const text = message.text.body;

      console.log(`Fariin cusub oo ka timid ${from}: ${text}`);

      const reply = await generateReply(from, text);
      await sendWhatsAppMessage(from, reply);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Khalad:", err.response?.data || err.message);
    res.sendStatus(200); // Meta u baahan tahay 200 si aysan u soo celin retry
  }
});

app.get("/", (req, res) => {
  res.send("WhatsApp AI Agent wuu shaqeynayaa ✅");
});

app.listen(PORT, () => {
  console.log(`Server wuu shaqeynayaa: http://localhost:${PORT}`);
});
