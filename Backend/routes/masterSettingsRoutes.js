const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('../controllers/masterSettingsController');
const { requireProductCreator } = require('../utils/roles');

router.get('/', controller.getSettings);
// Creating a product is Admin + Manager; editing/removing products and every other mutation stay Admin-only.
router.post('/stone-rates', requireProductCreator, controller.addStoneRate);
router.use(require('../utils/auth').allowRoles('Admin'));
router.put('/', controller.updateSettings);
router.put('/profile', controller.updateProfile);
router.post('/logo', express.raw({ type: ['image/png', 'image/jpeg'], limit: '2mb' }), controller.uploadLogo);

router.post('/trucks', controller.addTruck);
router.delete('/trucks/:truckNumber', controller.deleteTruck);

router.post('/destinations', controller.addDestination);
router.delete('/destinations/:destination', controller.deleteDestination);

router.put('/stone-rates/:rateId', controller.updateStoneRate);
router.delete('/stone-rates/:rateId', controller.deleteStoneRate);

router.put('/royalty', controller.updateRoyalty);

module.exports = router;
