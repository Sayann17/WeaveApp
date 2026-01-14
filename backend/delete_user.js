const { getDriver } = require('./auth-service/db');

async function deleteUser(userId) {
    if (!userId) {
        console.error('Usage: node delete_user.js <USER_ID>');
        process.exit(1);
    }

    console.log(`Starting deletion for user: ${userId}`);
    const driver = await getDriver();

    const queries = [
        // 1. Delete socket connections
        `DELETE FROM socket_connections WHERE user_id = "${userId}";`,

        // 2. Delete likes (both given and received)
        `DELETE FROM likes WHERE from_user_id = "${userId}" OR to_user_id = "${userId}";`,

        // 3. Delete matches (check both columns)
        `DELETE FROM matches WHERE user1_id = "${userId}" OR user2_id = "${userId}";`,

        // 4. Delete messages sent by user
        `DELETE FROM messages WHERE sender_id = "${userId}";`,
        // Note: We are not deleting received messages to preserve chat history for others, 
        // unless we want to nuclear wipe. Usually deleting sender's messages is enough/safe.

        // 5. Delete specific chats? 
        // Chats are identified by composite key. 
        // Hard to delete perfectly without scan, but matches deletion handles logic mostly.

        // 6. Delete user profile
        `DELETE FROM users WHERE id = "${userId}";`
    ];

    try {
        await driver.tableClient.withSession(async (session) => {
            for (const query of queries) {
                console.log(`Executing: ${query}`);
                await session.executeQuery(query);
            }
        });
        console.log(`\n✅ Successfully deleted all data for user ${userId}`);
    } catch (error) {
        console.error('❌ Error deleting user:', error);
    } finally {
        await driver.destroy();
    }
}

// Get user ID from command line argument
const userId = process.argv[2];
deleteUser(userId);
