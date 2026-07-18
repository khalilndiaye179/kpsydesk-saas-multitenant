"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = require("bcryptjs");
var prisma = new client_1.PrismaClient();
/**
 * Seed minimal — ne crée QUE les données système transversales :
 *   1. Plans tarifaires (Starter, Pro, Enterprise)
 *   2. Compte Super-Administrateur global (legacy)
 *
 * AUCUNE donnée de test (assets, tickets, utilisateurs fictifs, fournisseurs,
 * contrats, licences, etc.) n'est insérée ici.
 * Chaque abonné commence avec un environnement 100 % vierge.
 */
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var hashedPassword, existingAdmin;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('=== Seed système KPSyDesk (minimal) ===\n');
                    // ─────────────────────────────────────────────────────────────────
                    // 1. Plans tarifaires (idempotent : upsert sur le nom)
                    // ─────────────────────────────────────────────────────────────────
                    console.log('📦 Création des plans tarifaires...');
                    return [4 /*yield*/, prisma.plan.upsert({
                            where: { name: 'Starter' },
                            update: {},
                            create: {
                                name: 'Starter',
                                price: 15000,
                                quotaAssets: 100,
                                quotaUsers: 10,
                                isPublic: true,
                            },
                        })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, prisma.plan.upsert({
                            where: { name: 'Pro' },
                            update: {},
                            create: {
                                name: 'Pro',
                                price: 45000,
                                quotaAssets: 500,
                                quotaUsers: 50,
                                isPublic: true,
                            },
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, prisma.plan.upsert({
                            where: { name: 'Enterprise' },
                            update: {},
                            create: {
                                name: 'Enterprise',
                                price: 120000,
                                quotaAssets: 999999,
                                quotaUsers: 999999,
                                isPublic: true,
                            },
                        })];
                case 3:
                    _a.sent();
                    // Plan interne legacy (non visible dans la liste publique)
                    return [4 /*yield*/, prisma.plan.upsert({
                            where: { name: 'Legacy' },
                            update: {},
                            create: {
                                name: 'Legacy',
                                price: 0,
                                quotaAssets: 999999,
                                quotaUsers: 999999,
                                isPublic: false,
                            },
                        })];
                case 4:
                    // Plan interne legacy (non visible dans la liste publique)
                    _a.sent();
                    console.log('   ✅ Plans : Starter, Pro, Enterprise, Legacy\n');
                    // ─────────────────────────────────────────────────────────────────
                    // 2. Compte Super-Administrateur global (legacy — sans tenantId)
                    // ─────────────────────────────────────────────────────────────────
                    console.log('👤 Création du compte Super-Admin...');
                    return [4 /*yield*/, bcrypt.hash('admin123', 12)];
                case 5:
                    hashedPassword = _a.sent();
                    return [4 /*yield*/, prisma.user.findFirst({
                            where: {
                                email: 'admin@entreprise.com',
                                tenantId: null,
                            },
                        })];
                case 6:
                    existingAdmin = _a.sent();
                    if (!existingAdmin) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma.user.update({
                            where: { id: existingAdmin.id },
                            data: {
                                password: hashedPassword,
                                firstName: 'Super',
                                lastName: 'Admin',
                                role: client_1.Role.ADMIN,
                                systemRole: 'Admin IT',
                                status: 'Actif',
                            },
                        })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, prisma.user.create({
                        data: {
                            email: 'admin@entreprise.com',
                            username: 'admin',
                            password: hashedPassword,
                            firstName: 'Super',
                            lastName: 'Admin',
                            role: client_1.Role.ADMIN,
                            systemRole: 'Admin IT',
                            status: 'Actif',
                            // Pas de tenantId → utilisateur global (portail legacy)
                        },
                    })];
                case 9:
                    _a.sent();
                    _a.label = 10;
                case 10:
                    console.log('   ✅ Super-Admin : admin@entreprise.com\n');
                    // ─────────────────────────────────────────────────────────────────
                    // FIN — aucune donnée métier insérée
                    // Chaque abonné inscrit via /api/tenants/signup reçoit un espace vierge.
                    // ─────────────────────────────────────────────────────────────────
                    console.log('=== Seed terminé. Base prête pour la production. ===');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
