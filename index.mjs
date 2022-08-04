import got from 'got';
import cron from 'cron';
import { ShardingManager } from 'discord.js';

import progress from './modules/progress.mjs';

const manager = new ShardingManager('./bot.mjs', { token: process.env.DISCORD_API_TOKEN });
let healthcheckJob = false;
let shutdownSignalReceived = false;

manager.on('shardCreate', shard => {
    console.log(`Created shard ${shard.id}`);
    shard.on('message', async message => {
        //console.log(`ShardingManager received message from shard ${shard.id}`, message);
        if (message.type === 'getReply') {
            const response = {uuid: message.uuid};
            try {
                if (message.data === 'userProgress') {
                    response.data = progress.getProgress(message.userId);
                }
                if (message.data === 'defaultUserProgress') {
                    response.data = progress.getDefaultProgress();
                }
                if (message.data === 'safeUserProgress') {
                    response.data = progress.getSafeProgress(message.userId);
                }
                if (message.data === 'userTarkovTrackerUpdateTime') {
                    response.data = progress.getUpdateTime(message.userId);
                }
                if (message.data === 'setUserLevel') {
                    progress.setLevel(message.userId, message.level);
                    response.data = message.level;
                }
                if (message.data === 'setUserTraderLevel') {
                    progress.setTrader(message.userId, message.traderId, message.level);
                    response.data = message.level;
                }
                if (message.data === 'setUserHideoutLevel') {
                    progress.setHideout(message.userId, message.stationId, message.level);
                    response.data = message.level;
                }
                if (message.data === 'setUserSkillLevel') {
                    progress.setSkill(message.userId, message.skillId, message.level);
                    response.data = message.level;
                }
                if (message.data === 'userTraderRestockAlerts') {
                    response.data = await progress.getRestockAlerts(message.userId);
                }
                if (message.data === 'addUserTraderRestockAlert') {
                    response.data = await progress.addRestockAlert(message.userId, message.traders);
                }
                if (message.data === 'removeUserTraderRestockAlert') {
                    response.data = await progress.removeRestockAlert(message.userId, message.traders);
                }
                if (message.data === 'setUserTarkovTrackerToken') {
                    progress.setToken(message.userId, message.token);
                    response.data = message.token;
                }
            } catch (error) {
                response.data = null;
                response.error = error;
            }
            return shard.send(response);
        }
        if (message.uuid) {
            shard.emit(message.uuid, message);
        }
    });
    shard.on('ready', () => {
        /*shard.eval(client => {
            client.users.fetch('144059683253125120', false).then(user => {
                if (!user) return;
                user.send(`🛒 Pappy restock in 1 minute 🛒`);
            });
            return true;
        });*/
    });
});

manager.spawn().then(shards => {
    console.log(`🟢 Systems now online with ${shards.size} shards`);
    progress.startRestockAlerts(manager);
    const shutdown = () => {
        if (shutdownSignalReceived) return;
        shutdownSignalReceived = true;
        console.log('Shutting down discord ShardManager');
        if (healthcheckJob) healthcheckJob.stop();
        for (const [index, shard] of manager.shards) {
            console.log(`Killing shard ${index}`);
            shard.kill();
        }
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGBREAK', shutdown);
    process.on('SIGHUP', shutdown);
}).catch(console.error);

if (process.env.NODE_ENV === 'production') {
    // A healthcheck cron to send a GET request to our status server
    // The cron schedule is expressed in seconds for the first value
    healthcheckJob = new cron.CronJob('*/45 * * * * *', () => {
        got(
            `https://status.tarkov.dev/api/push/${process.env.HEALTH_ENDPOINT}?msg=OK`,
            {
                headers: { "user-agent": "stash-tarkov-dev" },
                timeout: { request: 5000 }
            }
        ).catch(error => {
            console.log('Healthcheck error:', error);
        });
    });
    healthcheckJob.start();

} else {
    console.log("Healthcheck disabled");
}
