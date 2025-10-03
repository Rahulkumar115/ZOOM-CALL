import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import connectToSocket from './controllers/socketManager.js';
import twilio from "twilio";

import cors from "cors";
import userRoutes from "./routes/users.routes.js";

const app = express();

const corsOptions = {
    origin: "https://zoom-call-frontend-hl2h.onrender.com",
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));


const server = createServer(app);
const io = connectToSocket(server);
const url = process.env.MONGO_URL;

app.set("port", (process.env.PORT || 8000));
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended: true}));

app.use("/api/v1/users", userRoutes);

//twilio route

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const client = twilio(apiKeySid, apiKeySecret, {accountSid});

app.get('/api/ice-servers', async (req, res) => {
    try {
        const token = await client.tokens.create();
        res.json(token.iceServers);
    } catch (error) {
        console.error('Error fetching ICE servers:', error);
        res.status(500).json({ error: 'Failed to fetch ICE servers' });
    }
});

const start = async () => {
    const connectionDb = await mongoose.connect(url);

    console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`);
    server.listen(app.get("port"), () => {
        console.log("LISTENING ON PORT 8000");
    });
};

start(); 


