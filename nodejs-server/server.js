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