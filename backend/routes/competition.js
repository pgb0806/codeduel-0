const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { Competition, Challenge, User } = require('../models');
const axios = require('axios');

// Get random challenge
const getRandomChallenge = async () => {
    const count = await Challenge.countDocuments();
    const random = Math.floor(Math.random() * count);
    return Challenge.findOne().skip(random);
};

// Start competition
router.post('/start', authMiddleware, async (req, res) => {
    try {
        const challenge = await getRandomChallenge();
        const competition = new Competition({
            challenge: challenge._id,
            players: [{ userId: req.userId }],
            startTime: new Date(),
            status: 'active'
        });
        await competition.save();
        
        // Send challenge details without hidden test cases
        const challengeData = {
            ...challenge.toObject(),
            testCases: challenge.testCases.filter(test => !test.isHidden)
        };
        
        res.json({ competition, challenge: challengeData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Add a new route for running code without submitting
router.post('/run', authMiddleware, async (req, res) => {
    try {
        const { code, language } = req.body;
        
        // Execute code with Judge0
        const options = {
            method: 'POST',
            url: `${process.env.RAPID_API_URL}`,
            headers: {
                'content-type': 'application/json',
                'X-RapidAPI-Host': process.env.RAPID_API_HOST,
                'X-RapidAPI-Key': process.env.RAPID_API_KEY
            },
            data: {
                source_code: code,
                language_id: language,
                stdin: '',
                base64_encoded: false
            }
        };

        const createResponse = await axios.request(options);
        const token = createResponse.data.token;

        if (!token) {
            throw new Error('No token received from Judge0');
        }

        // Get results
        const result = await getSubmissionResult(token);
        
        res.json({
            status: result.status,
            stdout: result.stdout,
            stderr: result.stderr,
            compile_output: result.compile_output
        });

    } catch (error) {
        console.error('Code execution error:', error);
        res.status(500).json({ 
            message: 'Error executing code', 
            error: error.message 
        });
    }
});

// Update the submit route to include more details
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        const { code, language, competitionId, codingTime, tabSwitches } = req.body;
        
        const competition = await Competition.findById(competitionId).populate('challenge');
        if (!competition) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        // Run all test cases
        const results = await Promise.all(competition.challenge.testCases.map(async testCase => {
            const options = {
                method: 'POST',
                url: `${process.env.RAPID_API_URL}`,
                headers: {
                    'content-type': 'application/json',
                    'X-RapidAPI-Host': process.env.RAPID_API_HOST,
                    'X-RapidAPI-Key': process.env.RAPID_API_KEY
                },
                data: {
                    source_code: code,
                    language_id: language,
                    stdin: testCase.input,
                    expected_output: testCase.expectedOutput,
                    base64_encoded: false
                }
            };

            const response = await axios.request(options);
            return getSubmissionResult(response.data.token);
        }));

        // Check if all test cases passed
        const allTestsPassed = results.every(r => r.status.id === 3);
        const hiddenTestsPassed = competition.challenge.testCases
            .filter(t => t.isHidden)
            .every((_, index) => results[index].status.id === 3);

        // Get the main result (first test case)
        const mainResult = results[0];

        // Update player's submission
        await Competition.findOneAndUpdate(
            { 
                _id: competitionId,
                'players.userId': req.userId 
            },
            {
                $set: {
                    'players.$.code': code,
                    'players.$.status': mainResult.status,
                    'players.$.memory': mainResult.memory,
                    'players.$.time': mainResult.time,
                    'players.$.codingTime': codingTime,
                    'players.$.tabSwitches': tabSwitches,
                    'players.$.hiddenTestsPassed': hiddenTestsPassed,
                    'players.$.allTestsPassed': allTestsPassed,
                    'players.$.submissionTime': new Date()
                }
            }
        );

        res.json({
            status: mainResult.status,
            memory: mainResult.memory,
            time: mainResult.time,
            stdout: mainResult.stdout,
            stderr: mainResult.stderr,
            compile_output: mainResult.compile_output,
            hiddenTestsPassed,
            allTestsPassed,
            tabSwitches
        });

    } catch (error) {
        console.error('Code submission error:', error);
        res.status(500).json({ 
            message: 'Error processing code submission', 
            error: error.message 
        });
    }
});

// Helper function to get submission result
async function getSubmissionResult(token) {
    const getOptions = {
        method: 'GET',
        url: `${process.env.RAPID_API_URL}/${token}`,
        headers: {
            'X-RapidAPI-Host': process.env.RAPID_API_HOST,
            'X-RapidAPI-Key': process.env.RAPID_API_KEY
        },
        params: { base64_encoded: false }
    };

    let result = null;
    let retries = 10;

    while (retries > 0) {
        const response = await axios.request(getOptions);
        if (response.data.status?.id !== 1 && response.data.status?.id !== 2) {
            result = response.data;
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries--;
    }

    if (!result) {
        throw new Error('Timed out waiting for submission result');
    }

    return result;
}

const calculateScore = ({ executionTime, memory, codingTime, tabSwitches, hiddenTestsPassed }) => {
    let score = 1000;
    
    // Deduct points for execution time (max 200 points)
    score -= (executionTime / 0.1) * 20;
    
    // Deduct points for memory usage (max 200 points)
    score -= (memory / 1000) * 20;
    
    // Deduct points for coding time (max 200 points)
    score -= (codingTime / 60) * 20;
    
    // Deduct points for tab switches (max 200 points)
    score -= tabSwitches * 10;
    
    // Bonus for passing hidden tests
    if (hiddenTestsPassed) {
        score += 200;
    }
    
    return Math.max(0, Math.round(score));
};

// Get challenge details
router.get('/challenge/:matchId', authMiddleware, async (req, res) => {
    try {
        const match = await Competition.findOne({
            _id: req.params.matchId,
            'players.userId': req.userId,
            status: 'active'
        }).populate('challenge');

        if (!match) {
            console.log('Match not found:', req.params.matchId);
            return res.status(404).json({ message: 'Match not found' });
        }

        console.log('Found match:', match._id);
        console.log('Challenge:', match.challenge ? match.challenge.title : 'No challenge');

        if (!match.challenge) {
            console.log('No challenge found for match');
            return res.status(404).json({ message: 'Challenge not found' });
        }

        // Filter out hidden test cases
        const challengeData = match.challenge.toObject();
        challengeData.testCases = challengeData.testCases.filter(test => !test.isHidden);
        
        res.json(challengeData);
    } catch (error) {
        console.error('Error fetching challenge:', error);
        res.status(500).json({ message: 'Error fetching challenge details' });
    }
});

module.exports = router; 