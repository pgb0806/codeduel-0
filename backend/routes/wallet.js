const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middleware/authMiddleware');

// Get user balance
router.get('/balance', authMiddleware, async (req, res) => {
  console.log(`Fetching balance for user: ${req.userId}`);
  try {
    const user = await User.findById(req.userId);
    console.log(`Balance for user ${req.userId}: ${user.MockCoinsBalance}`);
    res.json({ balance: user.MockCoinsBalance });
  } catch (error) {
    console.error(`Error fetching balance for user ${req.userId}:`, error);
    res.status(500).json({ message: error.message });
  }
});

// Get transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update balance
router.put('/update', authMiddleware, async (req, res) => {
  console.log(`Updating balance for user ${req.userId}:`, req.body);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, type } = req.body;
    const user = await User.findById(req.userId).session(session);

    if (!user) {
      throw new Error('User not found');
    }

    if (type === 'debit' && user.MockCoinsBalance < amount) {
      throw new Error('Insufficient balance');
    }

    user.MockCoinsBalance += type === 'credit' ? amount : -amount;
    await user.save();

    const transaction = new Transaction({
      userId: req.userId,
      type,
      amount,
      description: type === 'credit' ? 'Deposit' : 'Withdrawal'
    });
    await transaction.save({ session });

    await session.commitTransaction();
    console.log(`Balance updated successfully for user ${req.userId}`);
    res.json({ balance: user.MockCoinsBalance });
  } catch (error) {
    console.error(`Error updating balance for user ${req.userId}:`, error);
    await session.abortTransaction();
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

module.exports = router; 