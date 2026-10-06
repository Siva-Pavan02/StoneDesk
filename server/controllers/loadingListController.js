const LoadingList = require('../models/LoadingList');

exports.createLoadingList = async (req, res, next) => {
  try {
    const data = req.body;
    if (!data.loadingListNumber) {
      data.loadingListNumber = 'LL-' + Date.now();
    }
    const list = new LoadingList(data);
    await list.save();
    res.status(201).json(list);
  } catch (error) {
    next(error);
  }
};

exports.getLoadingLists = async (req, res, next) => {
  try {
    const lists = await LoadingList.find().sort({ createdAt: -1 });
    res.status(200).json(lists);
  } catch (error) {
    next(error);
  }
};

exports.getLoadingListById = async (req, res, next) => {
  try {
    const list = await LoadingList.findById(req.params.id);
    if (!list) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

exports.updateLoadingList = async (req, res, next) => {
  try {
    const list = await LoadingList.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!list) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

exports.deleteLoadingList = async (req, res, next) => {
  try {
    const list = await LoadingList.findByIdAndDelete(req.params.id);
    if (!list) return res.status(404).json({ error: 'Not found' });
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Draft', 'Loading', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const list = await LoadingList.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
    if (!list) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};
