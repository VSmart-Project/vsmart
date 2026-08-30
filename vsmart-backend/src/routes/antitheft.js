const express = require('express');
const router = express.Router();
const { enableAntitheft, disableAntitheft } = require('../controllers/antitheftController');

/**
 * @swagger
 * tags:
 *   name: Anti-theft
 *   description: Bật tắt chế độ chống trộm qua Geofence (Vùng an toàn ảo)
 */

/**
 * @swagger
 * /api/antitheft/{deviceId}/enable:
 *   post:
 *     summary: Kích hoạt chế độ chống trộm cho thiết bị
 *     description: Lấy vị trí ngay lập tức, vẽ một vòng tròn bán kính nhỏ (2m) làm hàng rào ảo. Sẽ gửi cảnh báo nếu xe vượt khỏi vùng này.
 *     tags: [Anti-theft]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã bật chống trộm.
 *       400:
 *         description: Thiết bị chưa có dữ liệu GPS, không thể tạo hàng rào.
 */
router.post('/:deviceId/enable', enableAntitheft);

/**
 * @swagger
 * /api/antitheft/{deviceId}/disable:
 *   post:
 *     summary: Tắt chế độ chống trộm
 *     description: Xóa hàng rào ảo trên AWS Location Service và tắt trạng thái giám sát.
 *     tags: [Anti-theft]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã tắt chống trộm thành công.
 */
router.post('/:deviceId/disable', disableAntitheft);

module.exports = router;
