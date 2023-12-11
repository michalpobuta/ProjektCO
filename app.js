const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const axios = require('axios');
const app = express();

const uri = "neo4j+s://e1d65d21.databases.neo4j.io";
const user = "neo4j";
const password = "TWkImoBBhgftZiT2tM2Ld_i0RrM6B8O-5RwpYvzLq80";

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

app.use(express.json());
app.use(cors());
app.post('/addUser', async (req, res) => {
    const {nazwa, email } = req.body;
    const resID = await axios.get('http://localhost:3000/getLastID/Uzytkownik');
    const id = resID.data.count;
    const session = driver.session();
    try {
        await session.run(
            'CREATE (u:Uzytkownik {id: $id, nazwa: $nazwa, email: $email}) RETURN u',
            { id, nazwa, email }
        );
        res.status(201).send('Użytkownik dodany');
    } catch (error) {
        res.status(500).send(error.message);
    }
    {
        await session.close();
    }
});

app.post('/addFilm', async (req, res) => {
    const { tytul, opis, gatunek } = req.body;
    const resID = await axios.get('http://localhost:3000/getLastID/Film');
    const id = resID.data.count;
    const session = driver.session();
    try {
        await session.run(
            'CREATE (f:Film {id: $id, tytul: $tytul, opis: $opis, gatunek: $gatunek}) RETURN f',
            { id, tytul, opis, gatunek }
        );
        res.status(201).send('Film dodany');
    } catch (error) {
        res.status(500).send(error.message);
    }
    {
        await session.close();
    }
});

app.post('/addRating', async (req, res) => {
    const { userId, filmId, ocena } = req.body;
    const session = driver.session();

    try {
        const existingRating = await session.run(
            'MATCH (u:Uzytkownik {id: $userId})-[r:OCENIA]->(f:Film {id: $filmId}) RETURN r',
            { userId, filmId }
        );

        if (existingRating.records.length > 0) {
            return res.status(400).send('Ten film został już oceniony przez tego użytkownika');
        }
        await session.run(
            'MATCH (u:Uzytkownik {id: $userId}), (f:Film {id: $filmId}) ' +
            'CREATE (u)-[:OCENIA {ocena: $ocena}]->(f)',
            { userId, filmId, ocena }
        );
        
        res.status(201).send('Ocena dodana');
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});


app.get('/getAllFilms', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run('MATCH (f:Film) RETURN f');
        const films = result.records.map(record => record.get('f').properties);
        res.json(films);
    } catch (error) {
        res.status(500).send(error.message);
    }
    {
        await session.close();
    }
});
app.get('/getAllUsers', async (req, res) => {
    const session = driver.session();
    try {
        const result = await session.run('MATCH (u:Uzytkownik) RETURN u');
        const users = result.records.map(record => record.get('u').properties);
        res.json(users);
    } catch (error) {
        res.status(500).send(error.message);
    } finally
    {
        await session.close();
    }
});

app.get('/getLastID/:table', async (req, res) => {
    const table = req.params.table;
    const session = driver.session();

    try {
        const result = await session.run(
            `MATCH (u:${table}) RETURN COUNT(u) AS count`
        );
        
        const count = result.records[0]?.get('count').toInt() || 0;
        res.send({ count: count });
    } catch (error) {
        res.status(500).send({ error: error.message });
    } finally {
        await session.close();
    }
});

app.get('/recommendations/:userId', async (req, res) => {
    const userId = parseInt(req.params.userId);
    const session = driver.session();

    try {
        const result = await session.run(
            `MATCH (targetUser:Uzytkownik {id: $userId})-[:OCENIA]->(commonFilm:Film)<-[:OCENIA]-(otherUser:Uzytkownik) \
            WHERE targetUser <> otherUser \
            MATCH (otherUser)-[:OCENIA]->(recommendedFilm:Film) \
            WHERE NOT (targetUser)-[:OCENIA]->(recommendedFilm) \
            RETURN recommendedFilm  AS Film, COUNT(*) AS recommendationCount \
            ORDER BY recommendationCount DESC \
            LIMIT 5`, { userId }
        );

        const recommendations = result.records.map(record => ({
            film: record.get('Film'),
            recommendationCount: record.get('recommendationCount').toInt()
        }));

        res.json(recommendations);
    } catch (error) {
        res.status(500).send({ error: error.message });
    } finally {
        await session.close();
    }
});

app.get('/getGraphData', async (req, res) => {
    const session = driver.session();
    try {
        const nodesResult = await session.run('MATCH (n) RETURN n');
        const nodes = nodesResult.records.map(record => {
            const node = record.get('n');
            return {
                id: `${node.labels[0]}_${node.identity.toInt()}`,
                label: node.labels[0],
                title: JSON.stringify(node.properties),
                
            };
        });
        const edgesResult = await session.run('MATCH ()-[r]->() RETURN r');
        const edges = edgesResult.records.map(record => {
            const edge = record.get('r');
            return {
                id: `rel_${edge.start.toInt()}_${edge.end.toInt()}`,
                from: edge.start ? `Uzytkownik_${edge.start.toInt()}` : 'undefined_node',
                to: edge.end ? `Film_${edge.end.toInt()}` : 'undefined_node',
                label: edge.type,
                ...edge.properties
            };
        });
        res.json({ nodes, edges });
    } catch (error) {
        res.status(500).send(error.message);
    } finally {
        await session.close();
    }
});




module.exports = app;