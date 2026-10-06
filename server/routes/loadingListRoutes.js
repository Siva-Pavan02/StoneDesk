const express = require('express');
const router = express.Router();
const controller = require('../controllers/loadingListController');

router.post('/', controller.createLoadingList);
router.get('/', controller.getLoadingLists);
router.get('/:id', controller.getLoadingListById);
router.put('/:id', controller.updateLoadingList);
router.delete('/:id', controller.deleteLoadingList);
router.patch('/:id/status', controller.updateStatus);

module.exports = router;
