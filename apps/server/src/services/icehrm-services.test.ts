import { describe, expect, it } from 'vitest';
import { IceHrmServices } from './icehrm-services.js';

describe('IceHrmServices Integration Suite', () => {
  describe('Leaves & Vacations Module', () => {
    it('crea solicitud de vacaciones calculando días hábiles y fecha de retorno', () => {
      const leave = IceHrmServices.createLeaveRequest({
        workerId: 'emp-101',
        leaveType: 'VACACIONES',
        startDate: '2026-10-08',
        endDate: '2026-10-14',
        reason: 'Vacaciones anuales reglamentarias',
        holidays: ['2026-10-12'],
      });

      expect(leave.id).toContain('leave-');
      expect(leave.workerId).toBe('emp-101');
      expect(leave.totalCalendarDays).toBe(7);
      expect(leave.totalBusinessDays).toBe(4); // Excluye fin de semana y feriado 12 de oct
      expect(leave.returnDate).toBe('2026-10-15');
      expect(leave.status).toBe('PENDIENTE');
    });

    it('calcula balance de vacaciones con escala LOTTT', () => {
      const balance = IceHrmServices.getVacationBalance('emp-101', 5, 10, 2);
      // 5 años de servicio: 15 + 4 = 19 días
      expect(balance.entitlementDays).toBe(19);
      expect(balance.bonusDays).toBe(19);
      expect(balance.daysTaken).toBe(10);
      expect(balance.daysPending).toBe(2);
      expect(balance.daysAvailable).toBe(7);
    });
  });

  describe('Overtime Module', () => {
    it('calcula horas extras diurnas, nocturnas y feriados para nómina', () => {
      const requests = [
        {
          id: 'ot-1',
          workerId: 'emp-101',
          date: '2026-10-01',
          startTime: '17:00',
          endTime: '19:00',
          category: 'DIURNA' as const,
          hours: 2,
          status: 'APROBADO' as const,
        },
        {
          id: 'ot-2',
          workerId: 'emp-101',
          date: '2026-10-02',
          startTime: '19:00',
          endTime: '21:00',
          category: 'NOCTURNA' as const,
          hours: 2,
          status: 'APROBADO' as const,
        },
      ];

      const result = IceHrmServices.computeOvertimeForPayroll(requests, 100);
      // Diurna: 2h * 150 = 300
      // Nocturna: 2h * 195 = 390
      expect(result.totalHours).toBe(4);
      expect(result.totalOvertimePay).toBe(690);
    });
  });

  describe('Loans & Advances Module', () => {
    it('valida límite del 75% en anticipos de prestaciones (Art. 144 LOTTT)', () => {
      expect(() => {
        IceHrmServices.registerLoan({
          workerId: 'emp-101',
          loanType: 'ANTICIPO_PRESTACIONES',
          totalAmount: 8000,
          installmentAmount: 500,
          accumulatedSeveranceFund: 10000, // 75% max = 7500 -> 8000 debe fallar
          startDate: '2026-10-01',
        });
      }).toThrow('75% máximo legal');
    });

    it('registra y amortiza cuotas hasta saldar', () => {
      const loan = IceHrmServices.registerLoan({
        workerId: 'emp-101',
        loanType: 'ANTICIPO_PRESTACIONES',
        totalAmount: 6000,
        installmentAmount: 3000,
        accumulatedSeveranceFund: 10000,
        startDate: '2026-10-01',
      });

      expect(loan.remainingBalance).toBe(6000);

      const step1 = IceHrmServices.deductLoanInstallment(loan);
      expect(step1.deductionAmount).toBe(3000);
      expect(step1.updatedLoan.remainingBalance).toBe(3000);
      expect(step1.isFullyPaid).toBe(false);

      const step2 = IceHrmServices.deductLoanInstallment(step1.updatedLoan);
      expect(step2.deductionAmount).toBe(3000);
      expect(step2.updatedLoan.remainingBalance).toBe(0);
      expect(step2.isFullyPaid).toBe(true);
      expect(step2.updatedLoan.status).toBe('LIQUIDADO');
    });
  });

  describe('Attendance Audit Module', () => {
    it('registra auditoría de ajuste manual de horas', () => {
      const audit = IceHrmServices.auditAttendanceCorrection({
        workerId: 'emp-101',
        date: '2026-10-02',
        field: 'horaSalida',
        oldValue: '16:00',
        newValue: '18:00',
        changedByUserId: 'usr-admin',
        reason: 'Omisión involuntaria en registro biométrico',
      });

      expect(audit.entityType).toBe('ASISTENCIA');
      expect(audit.fieldChanged).toBe('horaSalida');
      expect(audit.oldValue).toBe('16:00');
      expect(audit.newValue).toBe('18:00');
      expect(audit.reason).toContain('Omisión');
    });
  });

  describe('Custom Fields & Travel Module', () => {
    it('valida campos personalizados dinámicos', () => {
      const defs = [
        {
          id: 'cf-1',
          code: 'talla_calzado',
          label: 'Talla de Calzado',
          dataType: 'NUMBER' as const,
          isRequired: true,
          section: 'DOTACION_SST' as const,
        },
      ];

      const valid = IceHrmServices.validateCustomFields(defs, { talla_calzado: 43 });
      expect(valid.length).toBe(0);

      const invalid = IceHrmServices.validateCustomFields(defs, { talla_calzado: 'invalido' });
      expect(invalid.length).toBe(1);
    });

    it('liquida viáticos y comisiones de servicio', () => {
      const record = {
        id: 'tr-10',
        workerId: 'emp-101',
        travelType: 'NACIONAL' as const,
        purpose: 'Auditoría en Maracaibo',
        origin: 'Caracas',
        destination: 'Maracaibo',
        departureDate: '2026-10-15',
        returnDate: '2026-10-18',
        advanceFundAmount: 800,
        expenses: [
          { id: 'exp-1', travelId: 'tr-10', concept: 'TRANSPORTE' as const, amount: 350, isVerified: true },
          { id: 'exp-2', travelId: 'tr-10', concept: 'HOSPEDAJE' as const, amount: 450, isVerified: true },
        ],
        status: 'RENDICION_PENDIENTE' as const,
      };

      const settlement = IceHrmServices.settleTravel(record);
      expect(settlement.totalExpensesClaimed).toBe(800);
      expect(settlement.balance).toBe(0);
      expect(settlement.isBalanced).toBe(true);
    });
  });
});
