
import * as fs from 'fs';
import * as path from 'path';
import { exportData } from '../../scripts/db-tools';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('readline');

describe('db-tools exportData', () => {
    let mockAdminDb: any;
    let mockConsoleLog: any;
    let mockConsoleError: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock Admin DB
        mockAdminDb = {
            collection: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
                forEach: (cb: any) => {
                    cb({ id: 'doc1', data: () => ({ name: 'Test' }) });
                }
            })
        };

        // Mock Console
        mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });
        mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Mock process.cwd
        (path.resolve as jest.Mock).mockReturnValue('/mock/path/.env.local');
        (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

        // Mock fs
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('KEY=VALUE');
        (fs.writeFileSync as jest.Mock).mockImplementation(() => { });
        (fs.statSync as jest.Mock).mockReturnValue({ size: 1024 });
        (fs.mkdirSync as jest.Mock).mockImplementation(() => { });
    });

    afterEach(() => {
        mockConsoleLog.mockRestore();
        mockConsoleError.mockRestore();
    });

    it('should export data successfully', async () => {
        await exportData(mockAdminDb);

        // Verify collections were fetched
        expect(mockAdminDb.collection).toHaveBeenCalledWith('users');
        expect(mockAdminDb.collection).toHaveBeenCalledWith('congregations');
        // ... verify others

        // Verify file write
        expect(fs.writeFileSync).toHaveBeenCalled();
        const callArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
        const writtenData = JSON.parse(callArgs[1]);

        expect(writtenData.meta.type).toBe('FULL_EXPORT_CLI');
        expect(writtenData.data.users).toHaveLength(1);
        expect(writtenData.data.users[0].name).toBe('Test');
    });

    it('should handle collection fetch errors gracefully', async () => {
        mockAdminDb.get.mockRejectedValueOnce(new Error('Fetch failed'));

        await exportData(mockAdminDb);

        // Should still try to write file (partial export)
        expect(fs.writeFileSync).toHaveBeenCalled();
        // Should log error
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Error fetching'), 'Fetch failed');
    });
});
