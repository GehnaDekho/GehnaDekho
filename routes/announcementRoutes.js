const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');

router.get('/active', announcementController.getActiveAnnouncements);
router.post('/', announcementController.createAnnouncement);
router.get('/', announcementController.getAllAnnouncements);
router.put('/:id', announcementController.updateAnnouncement);
router.delete('/:id', announcementController.deleteAnnouncement);

module.exports = router;
