let Discord = require("discord.js");
let firebase = require("firebase-admin");
const secrets = require("./secrets");

const serviceAccount = require("./firebase_key.json");

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://discord-rainbow.firebaseio.com"
});

const prefix = "r!";
const rolePrefix = "🌈 ";

let bot = new Discord.Client();
let firestore = firebase.firestore();

const defaultData = {
    colorSaturation: 1,
    colorValue: 1,
    respectHoists: true,
    includeBots: true,
    maxRoleCount: 0
};

bot.login(secrets.discordToken);

bot.on("ready", () => {
    bot.user.setActivity(prefix + "help");
});

bot.on("message", async (msg) => {
    const split = msg.content.trim().split(" ");
    if(split.length < 1) return;
    const commandRaw = split[0].toLowerCase().trim();
    if(!commandRaw.startsWith(prefix)) return;
    const command = commandRaw.replace(prefix, "");

    if(command == "help"){
        msg.channel.send(
            "**Rainbow Roles Commands**\n" +
            `> \`${prefix}config\`: Adjust Rainbow Roles settings. Use \`${prefix}config\` for more information.\n` +
            `> \`${prefix}apply\`: Creates the rainbow with your specified settings!\n` +
            `> \`${prefix}cleanup\`: Deletes all rainbow roles. Use this to quickly undo the rainbow.\n` +
            `> \`${prefix}help\`: Displays this help menu.\n` +
            `> \`${prefix}invite\`: Get an invite link to add Rainbow Roles to your own server!\n`
        );
        return;
    } else if(command == "invite"){
        msg.channel.send(`Invite Rainbow Roles to your own server!\n> https://discord.com/oauth2/authorize?scope=bot&client_id=789673374031937556&permissions=268503040`);
    } else if(command == "apply"){
        if(!msg.member.hasPermission("ADMINISTRATOR")){
            msg.channel.send("❌ Only server administrators can use this command.");
            return;
        }
        msg.channel.send("⌛ Applying roles. This may take a moment...");
        const data = await fetchGuildData(msg.guild.id);
        if(data == null){
            msg.channel.send("❌ Configuration options could not be fetched from Rainbow Roles server. Please try again later.");
            return;
        }
        msg.channel.send("ℹ️ Fetched configuration options. Creating roles...");
        let members = (await msg.guild.members.fetch()).array();
        
        if(!data.includeBots){
            members = members.filter(i => !i.user.bot);
        }
        const sortedMembers = members.sort((a, b) => 
            memberSortLambda(a, b, data.respectHoists)
        );
        // console.log(sortedMembers.map(i => i.displayName));
        let existingRoles = (await msg.guild.roles.fetch()).cache.array();
        existingRoles = existingRoles.filter(role => role.client.user.id == bot.user.id && role.name.startsWith(rolePrefix));

        let roles = {};
        for(let role of existingRoles){
            roles[parseInt(role.name.replace(rolePrefix, ""))] = role;
        }

        const roleCount = (data.maxRoleCount <= 0 ? sortedMembers.length : (Math.min(data.maxRoleCount, sortedMembers.length)));
        let rolePosition = msg.guild.me.roles.highest.position - 1;
        for(let i = 0; i < roleCount; i++){
            const rgb = HSVtoRGB((i / roleCount), data.colorSaturation, data.colorValue);
            if(i in roles){
                await roles[i].setPosition(rolePosition);
                await roles[i].setColor([rgb.r, rgb.g, rgb.b]);
            }else{
                roles[i] = await msg.guild.roles.create({
                    data: {
                        name: rolePrefix + i.toString(),
                        color: [rgb.r, rgb.g, rgb.b],
                        position: rolePosition
                    },
                    reason: "Rainbow Roles apply command"
                });
            }
        }
        msg.channel.send("ℹ️ Created roles. Assigning to users...");
        const allRoles = Object.values(roles);
        for(let i in sortedMembers){
            const member = sortedMembers[i];
            await member.roles.remove(allRoles);
            const roleIdx = data.maxRoleCount <= 0 ? i : Math.floor(i / sortedMembers.length * roleCount);
            await member.roles.add(roles[roleIdx]);
        }
        msg.channel.send("✅ Done!\n> Not working? Make sure this bot's highest role is on top and try again.");

    } else if(command == "cleanup"){
        if(!msg.member.hasPermission("ADMINISTRATOR")){
            msg.channel.send("❌ Only server administrators can use this command.");
            return;
        }
        let existingRoles = (await msg.guild.roles.fetch()).cache.array();
        existingRoles = existingRoles.filter(role => role.client.user.id == bot.user.id && role.name.startsWith(rolePrefix));
        msg.channel.send("⌛ Deleting all Rainbow Roles. This may take a moment...");
        await Promise.all(
            existingRoles.map(role => role.delete("Rainbow Roles cleanup command"))
        );
        msg.channel.send("✅ Done!");
    } else if(command == "config"){
        if(!msg.member.hasPermission("ADMINISTRATOR")){
            msg.channel.send("❌ Only server administrators can use this command.");
            return;
        }
        if(split.length < 2){
            msg.channel.send(
                `Use \`${prefix}config <setting name> <new value>\` to change a setting.\n` +
                "Configuration options:\n" +
                "> `saturation`: The saturation, as a percentage from 0-100, of the role colors.\n" +
                "> `value`: The value (darkness), as a percentage from 0-100, of the role colors.\n" +
                "> `maxroles`: (integer) the max number of roles to create. Set to `0` to not limit the number of roles. The higher this number, the smoother the gradient will be.\n" +
                "> `respecthoists`: set to `true` to take hoisted roles into account, otherwise set to `false`.\n" +
                "> `includebots`: set to `true` to assign bots rainbow roles, otherwise set to `false`.\n"
            );
            return;
        }
        const subcommand = split[1].toLowerCase().trim();
        if(split.length < 3){
            msg.channel.send("❌ Please provide a new value!");
            return;
        }
        let value = split[2].toLowerCase().trim();
        if(subcommand == "saturation"){
            let v = parseFloat(value.replace("%", ""));
            if(isNaN(v) || v < 0 || v > 100){
                msg.channel.send("❌ Value must be a number between 0 and 100.");
                return;
            }
            await updateGuildData(msg.guild.id, {
                colorSaturation: v / 100
            });
        } else if(subcommand == "value"){
            let v = parseFloat(value.replace("%", ""));
            if(isNaN(v) || v < 0 || v > 100){
                msg.channel.send("❌ Value must be a number between 0 and 100.");
                return;
            }
            await updateGuildData(msg.guild.id, {
                colorValue: v / 100
            });
        } else if(subcommand == "maxroles"){
            let v = parseInt(value);
            if(isNaN(v) || v < 0){
                msg.channel.send("❌ Value must be a nonnegative whole number.");
                return;
            }
            await updateGuildData(msg.guild.id, {
                maxRoleCount: v
            });
        } else if(subcommand == "respecthoists"){
            if(value !== "true" && value !== "false"){
                msg.channel.send("❌ Value must be either `true` or `false`.");
                return;
            }
            await updateGuildData(msg.guild.id, {
                respectHoists: value === "true" ? true : false
            });
        } else if(subcommand == "includebots"){
            if(value !== "true" && value !== "false"){
                msg.channel.send("❌ Value must be either `true` or `false`.");
                return;
            }
            await updateGuildData(msg.guild.id, {
                includeBots: value === "true" ? true : false
            });
        } else {
            msg.channel.send("❌ That's not a valid configuration option!");
            return;
        }
        msg.channel.send("✅ Settings updated!");
    } else {
        msg.channel.send(`❌ Command not recognized. Use \`${prefix}help\` for help.`);
    }
});

function memberSortLambda(a, b, respectHoists){
    if(respectHoists){
        const highestA = a.roles.hoist == null ? 0 : a.roles.hoist.position;
        const highestB = b.roles.hoist == null ? 0 : b.roles.hoist.position;
        if(highestA != highestB) return highestB - highestA;
    }
    return a.displayName.localeCompare(b.displayName);
}

async function fetchGuildData(serverId){
    let doc;
    try {
        doc = await firestore.collection("guilds").doc(serverId).get();
    } catch(e){
        console.error(e);
        return null;
    }
    if(doc.exists){
        return doc.data();
    } else {
        try {
            await firestore.collection("guilds").doc(serverId).set(defaultData);
        } catch(e) {
            console.error(e);
            return null;
        }
        return await fetchGuildData(serverId);
    }
}

async function updateGuildData(serverId, updateData){
    try {
        await firestore.collection("guilds").doc(serverId).update(updateData);
    } catch(e) {
        if(e.code == 5){ // NOT_FOUND
            await firestore.collection("guilds").doc(serverId).set({
                colorSaturation: 1,
                colorValue: 1,
                respectHoists: true,
                includeBots: true,
                maxRoleCount: 0
            });
            return updateGuildData(serverId, updateData);
        }
        console.error(e);
    }
}

// https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}