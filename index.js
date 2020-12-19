let Discord = require("discord.js");
let firebase = require("firebase-admin");
const secrets = require("./secrets");

const serviceAccount = require("./firebase_key.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://discord-rainbow.firebaseio.com"
});

const prefix = "c!";

let bot = new Discord.Client();
let firestore = firebase.firestore();
let debugUser = null;

bot.login(secrets.discordToken);

bot.on("ready", () => {

});

bot.on("message", (msg) => {
    const split = msg.trim().split(" ");
    if(split.length < 1) return;
    const commandRaw = split[0].toLowerCase().trim();
    if(!commandRaw.startsWith(prefix)) return;
    const command = command.replace(prefix, "");

    if(command == "help"){
        msg.channel.send("Lol");
    } else if(command == "apply"){
        // 
    } else if(command == "config"){

    }
});

function fetchGuildData(serverId){
    firestore.collection("guild")
}