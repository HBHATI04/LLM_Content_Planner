const express = require("express");
const axios = require("axios");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "phi3", // change here if needed
        prompt: prompt,
        stream: false
      }
    );

    res.json({ reply: response.data.response });

  } catch (err) {
    console.log("OLLAMA ERROR:", err.message);
    res.status(500).json({ message: "Ollama error" });
  }
});

module.exports = router;
