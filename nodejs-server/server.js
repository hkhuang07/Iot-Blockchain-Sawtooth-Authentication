//REST API VERSION

const express = require("express");
const axios = require("axios");
const path = require("path");
const app = express();
const port= 3001;

app.use(express.static("public"));

app.get("/api/data", async (req, res) => {
  try {
    const response = await axios.get(
      "http://rest-api:8008/state?address=1cf126"
    );
    const data = response.data.data.map((item) => {
      // Sawtooth IntegerKey lưu trữ dữ liệu dạng CBOR hoặc text đơn giản tùy phiên bản
      // Ở bản demo này chúng ta giải mã base64
      let decoded = Buffer.from(item.data, "base64")
        .toString("ascii")
        .replace(/[^\x20-\x7E]/g, "");
      return { address: item.address, raw: decoded };
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "There is no data on the Blockchain yet." });
  }
});

app.listen(port, () =>
  console.log("Dashboard running at http://localhost:3001")
);

/*  LOCALHOST VERSION
const express = require('express');
const axios = require('axios');
const app = express();

app.get('/api/data', async (req, res) => {
    try {
        // Lấy toàn bộ trạng thái của intkey
        const response = await axios.get('http://localhost:8008/state?address=1cf126');
        const data = response.data.data.map(item => {
            // Giải mã Base64 dữ liệu từ Blockchain
            let decoded = Buffer.from(item.data, 'base64').toString();
            return { address: item.address, raw: decoded };
        });
        res.json(data);
    } catch (error) {
        res.status(500).send(error.message);
    }
});
app.listen(3000, () => console.log('The website runs on port 3000.'));
*/
