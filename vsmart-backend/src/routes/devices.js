const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: Quản lý thiết bị giám sát (CRUD) và dữ liệu Tracking trực tiếp
 */

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Lấy danh sách tất cả thiết bị
 *     description: Lấy dữ liệu meta từ DynamoDB, đồng thời merge tự động với vị trí tức thời (realtime) từ AWS Location Service.
 *     tags: [Devices]
 *     responses:
 *       200:
 *         description: OK. Trả về mảng devices đang thiết lập và mảng unregistered (đang phát GSP nhưng chưa đăng ký thông tin).
 *       401:
 *         description: Unauthorized (Thiếu hoặc sai JWT token)
 */
router.get('/', deviceController.getAllDevices);

/**
 * @swagger
 * /api/devices/{id}:
 *   get:
 *     summary: Lấy chi tiết một thiết bị
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
 *     responses:
 *       200:
 *         description: OK.
 *       404:
 *         description: Không tìm thấy thiết bị
 */
router.get('/:id', deviceController.getDeviceById);

/**
 * @swagger
 * /api/devices/{id}/history:
 *   get:
 *     summary: Xem lịch sử di chuyển
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: OK. Trả về mảng tọa độ.
 */
router.get('/:id/history', deviceController.getDeviceHistory);

/**
 * @swagger
 * /api/devices:
 *   post:
 *     summary: Thêm thiết bị mới
 *     tags: [Devices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deviceId:
 *                 type: string
 *               displayName:
 *                 type: string
 *               type:
 *                 type: string
 *                 example: "car"
 *     responses:
 *       201:
 *         description: Tạo thành công.
 */
router.post('/', deviceController.createDevice);

/**
 * @swagger
 * /api/devices/{id}:
 *   put:
 *     summary: Cập nhật thông tin thiết bị
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated.
 */
router.put('/:id', deviceController.updateDevice);

/**
 * @swagger
 * /api/devices/{id}:
 *   delete:
 *     summary: Xóa thiết bị khỏi hệ thống (Cả DB lẫn Tracker)
 *     tags: [Devices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công.
 */
router.delete('/:id', deviceController.deleteDevice);

module.exports = router;
