require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;

async function getPrice(ticker) {
    const url = `https://api.twelvedata.com/price?symbol=${ticker}&apikey=${TWELVE_DATA_API_KEY}`;
    const response = await axios.get(url);
    if (response.data.status === 'error') {
        throw new Error(response.data.message);
    }
    return response.data;
}

async function getNews(ticker) {
    try {
        const url = `https://www.marketwatch.com/investing/stock/${ticker.toLowerCase()}/news`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });
        const $ = cheerio.load(data);
        const firstHeadlineElem = $('.article__headline a').first();
        const headline = firstHeadlineElem.text().trim();
        const headlineUrl = firstHeadlineElem.attr('href');

        if (!headline || !headlineUrl) {
            return { headline: 'No recent headlines found.', url: '' };
        }
        return { headline, url: headlineUrl };
    } catch (error) {
        // Don't let the scraper failing stop the whole radar endpoint
        console.error(`Scraping failed for ${ticker}: ${error.message}`);
        return { headline: 'Could not fetch news.', url: '' };
    }
}

app.get('/price', async (req, res) => {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required' });
    }

    try {
        const priceData = await getPrice(ticker);
        res.json(priceData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stock price', details: error.message });
    }
});

app.get('/news', async (req, res) => {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required' });
    }

    try {
        const newsData = await getNews(ticker);
        res.json({ ticker: ticker.toUpperCase(), ...newsData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news', details: error.message });
    }
});

app.get('/radar', async (req, res) => {
    const { ticker } = req.query;

    if (!ticker) {
        return res.status(400).json({ error: 'Ticker symbol is required' });
    }

    try {
        const [priceData, newsData] = await Promise.all([
            getPrice(ticker),
            getNews(ticker)
        ]);

        res.json({
            ticker: ticker.toUpperCase(),
            price: priceData.price,
            headline: newsData.headline,
            url: newsData.url
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch radar data', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
