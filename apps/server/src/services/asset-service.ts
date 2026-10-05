import type { Repositories, AssignedAssetRecord } from '../db/types.js';

export class AssetService {
  constructor(private repos: Repositories) {}

  async listAssetsByEmployee(employeeId: string): Promise<AssignedAssetRecord[]> {
    return this.repos.assets.listByEmployeeId(employeeId);
  }

  async listAllAssets(): Promise<AssignedAssetRecord[]> {
    return this.repos.assets.list();
  }

  async assignAsset(params: {
    employeeId: string;
    assetType: AssignedAssetRecord['assetType'];
    assetCode?: string | undefined;
    serialNumber?: string | undefined;
    description: string;
  }): Promise<AssignedAssetRecord> {
    const code = params.assetCode || `AST-${Date.now().toString().slice(-6)}`;
    return this.repos.assets.create({
      employeeId: params.employeeId,
      assetType: params.assetType,
      assetCode: code,
      serialNumber: params.serialNumber,
      description: params.description,
      assignedDate: new Date().toISOString().slice(0, 10),
      status: 'asignado',
    });
  }

  async returnAsset(params: {
    assetId: string;
    notes?: string;
  }): Promise<AssignedAssetRecord> {
    const updated = await this.repos.assets.updateStatus(
      params.assetId,
      'devuelto',
      new Date().toISOString().slice(0, 10),
    );
    if (!updated) {
      throw new Error(`Activo ${params.assetId} no encontrado`);
    }
    return updated;
  }
}
