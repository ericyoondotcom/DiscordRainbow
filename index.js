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

bot.on("message", async (msg) => {
    const split = msg.trim().split(" ");
    if(split.length < 1) return;
    const commandRaw = split[0].toLowerCase().trim();
    if(!commandRaw.startsWith(prefix)) return;
    const command = command.replace(prefix, "");

    if(command == "help"){
        msg.channel.send("Lol");
    } else if(command == "apply"){
        const data = await fetchGuildData(msg.guild.id);
        const members = (await msg.guild.members.fetch()).array();
        // const sortIndices = {
        //     // id: [highestHoistedRolePosition, displayName]
        // };
        // for(const member of members){
        //     sortIndices[member.id] = getMemberSortIndex(i, data.respectHoists, data.includeBots);
        // }

        // const sortedMembers = members.sort((a, b) => sortIndices[a.id] - sortIndices[b.id]);
        const sortedMembers = members.sort((a, b) => 
            memberSortLambda(a, b, data.respectHoists, data.includeBots)
        );

        console.log(sortedMembers);
    } else if(command == "config"){

    }
});

// Since sort() can't directly take an async lambda, store the sort indices and then sort.
// async function getMemberSortIndex(member, respectHoists, includeBots){
//     const roles = member.roles.fetch()
// }
function memberSortLambda(a, b, respectHoists, includeBots){
    const highestA = a.roles.hoist == null ? -1 : a.roles.hoist.position;
    const highestB = b.roles.hoist == null ? -1 : b.roles.hoist.position;
    if(highestA != highestB) return highestA - highestB;
    return a.displayName.localeCompare(b.displayName);
}

async function fetchGuildData(serverId){
    let doc;
    try {
        doc = await firestore.collection("guild").doc(serverId).get();
    } catch(e){
        console.error(e);
        return null;
    }
    if(doc.exists){
        return doc.data();
    } else {
        try {
            await firestore.collection("guild").doc(serverId).set({
                colorSaturation: 1,
                colorValue: 1,
                respectHoists: true,
                includeBots: true
            });
        } catch(e) {
            console.error(e);
            return null;
        }
        return await fetchGuildData(serverId);
    }
}