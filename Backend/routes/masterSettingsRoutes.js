const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/masterSettingsController');

router.get('/', controller.getSettings);
router.use(require('../utils/auth').allowRoles('Admin'));
router.put('/', controller.updateSettings);
router.put('/profile', controller.updateProfile);
router.post('/logo', express.raw({ type: ['image/png', 'image/jpeg'], limit: '2mb' }), controller.uploadLogo);

router.post('/trucks', controller.addTruck);
router.delete('/trucks/:truckNumber', controller.deleteTruck);

router.post('/destinations', controller.addDestination);
router.delete('/destinations/:destination', controller.deleteDestination);

router.post('/stone-rates', controller.addStoneRate);
router.put('/stone-rates/:rateId', controller.updateStoneRate);
router.delete('/stone-rates/:rateId', controller.deleteStoneRate);

router.put('/royalty', controller.updateRoyalty);

module.exports = router;
