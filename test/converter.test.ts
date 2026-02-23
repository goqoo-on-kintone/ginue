import { convertAppSettingsJson, convertAppFormFieldsJson, convertAppIdToName } from '../src/converter'
import type { Ktn } from '../src/types'

describe('converter', () => {
  describe('convertAppSettingsJson', () => {
    it('pull時（isPush=false）: nameを<APP_NAME>にマスク', () => {
      const settings = { name: 'My App', description: 'Test app' }
      convertAppSettingsJson(settings, false)
      expect(settings.name).toBe('<APP_NAME>')
      expect(settings.description).toBe('Test app')
    })

    it('push時（isPush=true）: nameを削除', () => {
      const settings = { name: 'My App', description: 'Test app' }
      convertAppSettingsJson(settings, true)
      expect(settings.name).toBeUndefined()
      expect(settings.description).toBe('Test app')
    })

    it('pull時: FILE型iconのfileKeyをマスク', () => {
      const settings = {
        name: 'App',
        icon: {
          type: 'FILE' as const,
          file: { fileKey: 'abc123', contentType: 'image/png', name: 'icon.png', size: '1000' },
        },
      }
      convertAppSettingsJson(settings, false)
      expect(settings.icon?.file?.fileKey).toBe('<FILE_KEY>')
    })

    it('push時: FILE型iconを削除', () => {
      const settings = {
        name: 'App',
        icon: {
          type: 'FILE' as const,
          file: { fileKey: 'abc123', contentType: 'image/png', name: 'icon.png', size: '1000' },
        },
      }
      convertAppSettingsJson(settings, true)
      expect(settings.icon).toBeUndefined()
    })

    it('PRESET型iconはそのまま', () => {
      const settings = {
        name: 'App',
        icon: { type: 'PRESET' as const, key: 'APP001' },
      }
      convertAppSettingsJson(settings, false)
      // PRESET型はfileプロパティがないので変換されない
      expect(settings.icon.type).toBe('PRESET')
    })
  })

  describe('convertAppFormFieldsJson', () => {
    it('pull時（opts=undefined）: lookupフィールドのrelatedAppをマスク', () => {
      const properties = {
        lookupField: {
          type: 'SINGLE_LINE_TEXT',
          code: 'lookupField',
          lookup: {
            relatedApp: { app: '123' },
            relatedKeyField: 'key',
          },
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convertAppFormFieldsJson(properties as any)
      expect(properties.lookupField.lookup.relatedApp.app).toBe('<APP_ID>')
    })

    it('pull時: referenceTableフィールドのrelatedAppをマスク', () => {
      const properties = {
        refTable: {
          type: 'REFERENCE_TABLE',
          code: 'refTable',
          referenceTable: {
            relatedApp: { app: '456' },
            condition: { field: 'f1', relatedField: 'f2' },
          },
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convertAppFormFieldsJson(properties as any)
      expect(properties.refTable.referenceTable.relatedApp.app).toBe('<APP_ID>')
    })

    it('ネストしたフィールド（サブテーブル内）も変換', () => {
      const properties = {
        subtable: {
          type: 'SUBTABLE',
          code: 'subtable',
          fields: {
            nestedLookup: {
              type: 'SINGLE_LINE_TEXT',
              code: 'nestedLookup',
              lookup: {
                relatedApp: { app: '789' },
                relatedKeyField: 'key',
              },
            },
          },
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convertAppFormFieldsJson(properties as any)
      expect(properties.subtable.fields.nestedLookup.lookup.relatedApp.app).toBe('<APP_ID>')
    })
  })

  describe('convertAppIdToName', () => {
    it('app.json: アプリ情報をマスク', () => {
      const ktn = { command: 'app.json' } as Ktn
      const appInfo = {
        appId: '10',
        name: 'Real App Name',
        creator: { code: 'admin', name: 'Administrator' },
        createdAt: '2023-01-01T00:00:00Z',
        modifiedAt: '2023-12-31T23:59:59Z',
        modifier: { code: 'user1', name: 'User One' },
        spaceId: '5',
        threadId: '100',
      }

      const result = convertAppIdToName(ktn, appInfo)

      expect(result).toBe(true)
      expect(appInfo.appId).toBe('<APP_ID>')
      expect(appInfo.name).toBe('<APP_NAME>')
      expect(appInfo.creator.code).toBe('<CREATOR_CODE>')
      expect(appInfo.creator.name).toBe('<CREATOR_NAME>')
      expect(appInfo.createdAt).toBe('<CREATED_AT>')
      expect(appInfo.modifier.code).toBe('<MODIFIER_CODE>')
      expect(appInfo.spaceId).toBe('<SPACE_ID>')
    })

    it('app/views.json: ビューIDをマスク', () => {
      const ktn = { command: 'app/views.json' } as Ktn
      const viewsInfo = {
        views: {
          view1: { id: '1', name: 'View 1', type: 'LIST' },
          view2: { id: '2', name: 'View 2', type: 'CALENDAR' },
        },
      }

      const result = convertAppIdToName(ktn, viewsInfo)

      expect(result).toBe(true)
      expect(viewsInfo.views.view1.id).toBe('<VIEW_ID>')
      expect(viewsInfo.views.view2.id).toBe('<VIEW_ID>')
      // 名前は変更されない
      expect(viewsInfo.views.view1.name).toBe('View 1')
    })

    it('app/reports.json: レポートIDをマスク', () => {
      const ktn = { command: 'app/reports.json' } as Ktn
      const reportsInfo = {
        reports: {
          report1: { id: '10', name: 'Report 1' },
          report2: { id: '20', name: 'Report 2' },
        },
      }

      const result = convertAppIdToName(ktn, reportsInfo)

      expect(result).toBe(true)
      expect(reportsInfo.reports.report1.id).toBe('<REPORT_ID>')
      expect(reportsInfo.reports.report2.id).toBe('<REPORT_ID>')
    })

    it('app/customize.json: カスタマイズ設定をマスク', () => {
      const ktn = { command: 'app/customize.json' } as Ktn
      const customizeInfo = {
        desktop: {
          js: [{ type: 'URL', url: 'https://example.com/script.js' }],
          css: [{ type: 'FILE', file: { fileKey: 'key1' } }],
        },
        mobile: {
          js: [],
          css: [],
        },
      }

      const result = convertAppIdToName(ktn, customizeInfo)

      expect(result).toBe(true)
      expect(customizeInfo.desktop.js).toEqual(['<DESKTOP_JS>'])
      expect(customizeInfo.desktop.css).toEqual(['<DESKTOP_CSS>'])
      expect(customizeInfo.mobile.js).toEqual(['<MOBILE_JS>'])
      expect(customizeInfo.mobile.css).toEqual(['<MOBILE_CSS>'])
    })

    it('app/form/fields.json: フィールド定義を変換', () => {
      const ktn = { command: 'app/form/fields.json' } as Ktn
      const fieldsInfo = {
        properties: {
          lookupField: {
            type: 'SINGLE_LINE_TEXT',
            code: 'lookupField',
            lookup: {
              relatedApp: { app: '123' },
              relatedKeyField: 'key',
            },
          },
        },
      }

      const result = convertAppIdToName(ktn, fieldsInfo)

      expect(result).toBe(true)
      expect(fieldsInfo.properties.lookupField.lookup.relatedApp.app).toBe('<APP_ID>')
    })

    it('対応していないコマンドはfalseを返す', () => {
      const ktn = { command: 'unknown/command.json' } as Ktn
      const data = { foo: 'bar' }

      const result = convertAppIdToName(ktn, data)

      expect(result).toBe(false)
      // データは変更されない
      expect(data.foo).toBe('bar')
    })
  })
})
