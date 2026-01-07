function success(data, headers = {}) {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(data)
    };
}

function error(statusCode, message, headers = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify({ error: message })
    };
}

module.exports = { success, error };
