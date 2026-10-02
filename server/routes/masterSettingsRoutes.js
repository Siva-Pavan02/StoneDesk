const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/masterSettingsController');

router.get('/', controller.getSettings);
router.put('/', controller.updateSettings);

router.post('/trucks', controller.addTruck);
router.delete('/trucks/:truckNumber', controller.deleteTruck);

router.post('/destinations', controller.addDestination);
router.delete('/destinations/:destination', controller.deleteDestination);

router.post('/stone-rates', controller.addStoneRate);
router.put('/stone-rates/:rateId', controller.updateStoneRate);
router.delete('/stone-rates/:rateId', controller.deleteStoneRate);

router.put('/royalty', controller.updateRoyalty);

module.exports = router;
