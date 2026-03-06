'use client'

import { useState, useEffect, useMemo } from 'react'
import { Droplet, MapPin, Building2, Facebook, Instagram, Youtube, Globe } from 'lucide-react'
import SearchableSelect from '@/components/SearchableSelect'
import type { LocationHierarchy, WaterSupplyMap, WaterSupplySystem } from '@/types'

export default function Home() {
  const [locationData, setLocationData] = useState<LocationHierarchy>({})
  const [waterSupplyData, setWaterSupplyData] = useState<WaterSupplyMap>([])
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [selectedRoad, setSelectedRoad] = useState('')
  const [searchResults, setSearchResults] = useState<WaterSupplySystem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load data
  useEffect(() => {
    Promise.all([
      fetch('/data/location_hierarchy.json').then(res => res.json()),
      fetch('/data/water_supply_map.json').then(res => res.json())
    ]).then(([locations, waterSupply]) => {
      setLocationData(locations)
      setWaterSupplyData(waterSupply)
      setIsLoading(false)
    })
  }, [])

  // Extract cities
  const cities = useMemo(() => {
    const citySet = new Set<string>()
    Object.keys(locationData).forEach(key => {
      const match = key.match(/^(.+?[縣市])/)
      if (match) {
        const city = match[1]
        citySet.add(city)
        if (city.includes('臺')) {
          citySet.add(city.replace(/臺/g, '台'))
        } else if (city.includes('台')) {
          citySet.add(city.replace(/台/g, '臺'))
        }
      }
    })
    return Array.from(citySet).sort()
  }, [locationData])

  // Extract districts
  const districts = useMemo(() => {
    if (!selectedCity) return []
    const districtSet = new Set<string>()
    
    const cityVariants = [
      selectedCity,
      selectedCity.replace(/台/g, '臺'),
      selectedCity.replace(/臺/g, '台')
    ]
    
    Object.keys(locationData).forEach(key => {
      for (const cityVariant of cityVariants) {
        if (key.startsWith(cityVariant)) {
          const district = key.replace(cityVariant, '')
          if (district) {
            districtSet.add(district)
          }
        }
      }
    })
    return Array.from(districtSet).sort()
  }, [selectedCity, locationData])

  // Extract roads
  const roads = useMemo(() => {
    if (!selectedCity || !selectedDistrict) return []
    
    const cityVariants = [
      selectedCity,
      selectedCity.replace(/台/g, '臺'),
      selectedCity.replace(/臺/g, '台')
    ]
    
    for (const cityVariant of cityVariants) {
      const key = `${cityVariant}${selectedDistrict}`
      const roadData = locationData[key]
      if (roadData) {
        return Object.keys(roadData).sort()
      }
    }
    
    return []
  }, [selectedCity, selectedDistrict, locationData])

  // Normalize text (處理台/臺的所有變體)
  const normalizeText = (text: string) => {
    // 統一將 台 和 臺 都轉成 臺
    return text.replace(/台/g, '臺').replace(/台/g, '臺').toLowerCase()
  }

  // Search - IMPROVED VERSION
  useEffect(() => {
    if (selectedDistrict) {
      performSearch()
    } else {
      setSearchResults([])
    }
  }, [selectedDistrict, selectedCity])

  const performSearch = () => {
    if (!selectedDistrict || !selectedCity) return

    const fullLocation = `${selectedCity}${selectedDistrict}`
    const normalizedFull = normalizeText(fullLocation)
    
    const districtName = selectedDistrict.replace(/[市縣區鄉鎮]/g, '')
    const normalizedDistrict = normalizeText(districtName)
    
    const cityName = selectedCity.replace(/[市縣]/g, '')
    const normalizedCity = normalizeText(cityName)
    
    // 用於儲存匹配結果和優先級
    const matches: Array<{system: WaterSupplySystem, priority: number}> = []
    
    waterSupplyData.forEach(system => {
      if (!system.area_text || !system.system) return
      
      const areaText = normalizeText(system.area_text)
      let priority = 0
      
      // ===== 優先級 1: 完整匹配「縣市+區域」（最高優先）=====
      if (areaText.includes(normalizedFull)) {
        priority = 100
        matches.push({system, priority})
        return
      }
      
      // ===== 優先級 1.5: 城市全市/全縣格式 =====
      // 例如：「新竹市全市」包含所有區域
      if (areaText.includes(`${normalizedCity}市全市`) || 
          areaText.includes(`${normalizedCity}全市`) ||
          areaText.includes(`${normalizedCity}縣全縣`) ||
          areaText.includes(`${normalizedCity}全縣`)) {
        priority = 95
        matches.push({system, priority})
        return
      }
      
            // ===== 優先級 2: 系統名稱包含該區域（需驗證不是其他地區）=====
      // 例如：查詢「石門區」，系統名稱是「0201石門區」
      // 但要避免：「東區」匹配到「竹東」「東勢」等
      const systemName = normalizeText(system.system)
      if (systemName.includes(normalizedDistrict)) {
        // 額外驗證：確保不是其他城市的同名區域
        // 方法：檢查區域文字中是否包含我們查詢的城市
        if (areaText.includes(normalizedCity)) {
          priority = 90
          matches.push({system, priority})
          return
        }
        // 或者系統名稱完全等於區域名稱（不是子字串）
        // 例如：「0201石門區」包含「石門」而不是「石門」是「下石門」的一部分
        const systemParts = systemName.replace(/[0-9]/g, '')  // 移除數字
        if (systemParts === normalizedDistrict || 
            systemParts === `${normalizedDistrict}區` ||
            systemParts === `${normalizedDistrict}鎮` ||
            systemParts === `${normalizedDistrict}鄉` ||
            systemParts === `${normalizedDistrict}市`) {
          if (areaText.includes(normalizedCity)) {
            priority = 90
            matches.push({system, priority})
            return
          }
        }
      }

      
      // ===== 優先級 3: 括號開頭格式（主要供水區域）+ 強制城市驗證 =====
      // 修復：基隆市信義區不應匹配到南投縣信義鄉
      const suffixes = ['區', '市', '鄉', '鎮']
      for (const suffix of suffixes) {
        const patterns = [
          `（${normalizedDistrict}${suffix}）`,
          `(${normalizedDistrict}${suffix})`,
        ]
        for (const pattern of patterns) {
          if (areaText.startsWith(pattern)) {
            // 【關鍵修復】強制要求城市驗證，避免同名區域誤匹配
            if (!areaText.includes(normalizedCity)) {
              continue  // 不包含城市名稱，跳過此匹配
            }
            
            const afterBracket = areaText.substring(pattern.length)
            const isInternalPlace = afterBracket.match(/^[一-龥]{1,4}[里村區市鄉鎮]/)
            
            if (!isInternalPlace) {
              priority = 80
              matches.push({system, priority})
              return
            } else {
              priority = 70
              matches.push({system, priority})
              return
            }
          }
        }
      }
      
      // ===== 優先級 3.5: 城市名（區名列表）格式 =====
      // 例如：「嘉義市（東區、西區）」
      for (const suffix of suffixes) {
        const patterns = [
          `${normalizedCity}（${normalizedDistrict}${suffix}、`,   // 嘉義市（東區、
          `${normalizedCity}（${normalizedDistrict}${suffix}）`,   // 嘉義市（東區）
          `${normalizedCity}(${normalizedDistrict}${suffix}、`,
          `${normalizedCity}(${normalizedDistrict}${suffix})`,
          `${normalizedCity}市（${normalizedDistrict}${suffix}、`,
          `${normalizedCity}市（${normalizedDistrict}${suffix}）`,
          `${normalizedCity}市(${normalizedDistrict}${suffix}、`,
          `${normalizedCity}市(${normalizedDistrict}${suffix})`,
        ]
        for (const pattern of patterns) {
          if (areaText.includes(pattern)) {
            priority = 75
            matches.push({system, priority})
            return
          }
        }
      }
      
      // ===== 優先級 3.6: 城市：區域名列表格式（無區字後綴）=====
      // 修復：基隆市的格式「基隆市：仁愛、中正、信義、中山...」
      // 同時支援：台南市的格式「台南市：...北區、...南區」
      // 也支援：台中市的格式「台中市東，西，南，北...等區」
      const cityListPatterns = [
        `${normalizedCity}市：${normalizedDistrict}、`,  // 基隆市：仁愛、
        `${normalizedCity}市：${normalizedDistrict}等`,  // 基隆市：...七堵等
        `${normalizedCity}縣：${normalizedDistrict}、`,
        `${normalizedCity}縣：${normalizedDistrict}等`,
        `、${normalizedDistrict}、`,  // 、仁愛、（在城市列表中）
        `、${normalizedDistrict}等`,  // 、七堵等
        `，${normalizedDistrict}，`,  // 台中格式：東，西，南，北
        `，${normalizedDistrict}等`,  // 台中格式：...，北等區
      ]
      
      for (const pattern of cityListPatterns) {
        if (areaText.includes(pattern)) {
          // 確保包含城市名稱，避免跨縣市誤配
          if (areaText.includes(normalizedCity) || areaText.includes(`${normalizedCity}市`) || areaText.includes(`${normalizedCity}縣`)) {
            priority = 74
            matches.push({system, priority})
            return
          }
        }
      }
      
            // ===== 優先級 4: 詞邊界分隔符（完整地名列表中）=====
      for (const suffix of suffixes) {
        const fullName = `${normalizedDistrict}${suffix}`
        const boundaryPatterns = [
          `、${fullName}全`,
          `、${fullName}、`,
          `、${fullName}\n`,    // 列表末尾換行
          `、${fullName}。`,    // 列表末尾句號
          `：${fullName}全`,
          `：${fullName}、`,
          `：${fullName}`,      // 「新北市：新店區」
          `。${fullName}全`,    // 「淡水區全區。石門區全區」
          ` ${fullName}全`,
          ` ${fullName}、`,
          `${fullName}全部`,
          `${fullName}全區`,
          `${fullName}全區，`,  // 「石門區全區，」
        ]
        
        for (const pattern of boundaryPatterns) {
          if (areaText.includes(pattern) && areaText.includes(normalizedCity)) {
            priority = 60
            matches.push({system, priority})
            return
          }
        }
      }
      
      // ===== 優先級 5: 全縣/全市格式 =====
      const countyPatterns = [
        `${normalizedCity}縣全縣`,
        `${normalizedCity}市全市`,
        `${normalizedCity}全縣`,
        `${normalizedCity}全市`,
      ]
      
      for (const pattern of countyPatterns) {
        if (areaText.includes(pattern)) {
          priority = 50
          matches.push({system, priority})
          return
        }
      }
      
      // ===== 優先級 6: 括號格式但不在開頭（次要供水區域）=====
      for (const suffix of suffixes) {
        const patterns = [
          `(${normalizedDistrict}${suffix})`,
          `（${normalizedDistrict}${suffix}）`,
        ]
        for (const pattern of patterns) {
          if (areaText.includes(pattern) && !areaText.startsWith(pattern)) {
            // 這種情況優先級較低，因為可能只是次要供水或備註
            if (areaText.includes(normalizedCity)) {
              priority = 30
              matches.push({system, priority})
              return
            }
          }
        }
      }
    })
    
    // 按優先級排序
    matches.sort((a, b) => b.priority - a.priority)
    
    // 🔥 修正：顯示所有匹配的系統（不論優先級）
    // 如果有重複，則都顯示
    const results = matches.map(m => m.system)

    setSearchResults(results)
  }




  // Reset selections
  const handleCityChange = (value: string) => {
    setSelectedCity(value)
    setSelectedDistrict('')
    setSelectedRoad('')
    setSearchResults([])
  }

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value)
    setSelectedRoad('')
  }

  // Get water source info
  const getWaterSourceInfo = (sources: any) => {
    const items = []
    
    if (sources.reservoir) {
      items.push({
        type: '水庫水',
        icon: <Droplet className="w-4 h-4" />,
        color: 'text-cyan-700 bg-cyan-50 border border-cyan-200',
        sources: sources.reservoir
      })
    }
    
    if (sources.surface_water) {
      items.push({
        type: '地面水',
        icon: <Droplet className="w-4 h-4" />,
        color: 'text-teal-700 bg-teal-50 border border-teal-200',
        sources: sources.surface_water
      })
    }
    
    if (sources.groundwater) {
      items.push({
        type: '地下水',
        icon: <Droplet className="w-4 h-4" />,
        color: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        sources: sources.groundwater
      })
    }
    
    if (sources.seawater) {
      items.push({
        type: '海水',
        icon: <Droplet className="w-4 h-4" />,
        color: 'text-blue-700 bg-blue-50 border border-blue-200',
        sources: sources.seawater
      })
    }
    
    return items
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: '#f4f4f0'}}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-transparent gradient-water"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{background: '#f4f4f0'}}>
      {/* Decorative River Background */}
      <div className="absolute top-0 left-0 w-full h-96 opacity-30 pointer-events-none">
        <img 
          src="/river-banner-1.png" 
          alt="" 
          className="w-full h-full object-cover object-center"
          style={{mixBlendMode: 'multiply'}}
        />
      </div>
      
      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 gradient-water-soft blur-2xl opacity-50"></div>
              <img 
                src="/logo.png" 
                alt="河川之初 Logo" 
                className="relative h-24 sm:h-32 object-contain drop-shadow-lg"
                style={{background: 'transparent'}}
              />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 mb-4 tracking-tight">
            你家的水，從哪裡來？
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-2">
            讓我們與河流重修舊好
          </p>
          <p className="text-sm text-gray-500">
            
          </p>
        </div>

        {/* Selection Card */}
        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 gradient-water-soft blur-3xl opacity-30"></div>
          <div className="relative z-10 space-y-6">
            {/* City Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                縣市
              </label>
              <select
                value={selectedCity}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl 
                  hover:border-cyan-300 hover:shadow-sm focus:outline-none focus:ring-2 
                  focus:ring-cyan-500 focus:border-transparent transition-all duration-200
                  appearance-none bg-no-repeat bg-right pr-10 text-gray-900"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundSize: '1.25rem',
                  backgroundPosition: 'right 0.75rem center'
                }}
              >
                <option value="">請選擇縣市</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* District Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                行政區
              </label>
              <select
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={!selectedCity}
                className={`w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl 
                  transition-all duration-200 appearance-none bg-no-repeat bg-right pr-10 text-gray-900
                  ${selectedCity 
                    ? 'hover:border-cyan-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent' 
                    : 'opacity-50 cursor-not-allowed bg-gray-50'
                  }`}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundSize: '1.25rem',
                  backgroundPosition: 'right 0.75rem center'
                }}
              >
                <option value="">請選擇行政區</option>
                {districts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            {/* Road Selection */}
            <SearchableSelect
              label="路段"
              options={roads}
              value={selectedRoad}
              onChange={setSelectedRoad}
              placeholder="請選擇路段"
              disabled={!selectedDistrict}
            />
          </div>
        </div>

        {/* Results Section */}
        {searchResults.length > 0 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Droplet className="w-6 h-6 text-cyan-600" />
              查詢結果
            </h2>
            <div className="space-y-4">
              {searchResults.map((system, index) => {
                const waterSources = getWaterSourceInfo(system.sources)
                
                return (
                  <div
                    key={index}
                    className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 
                      hover:shadow-xl hover:border-cyan-200 transition-all duration-300 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 gradient-water-soft blur-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {system.system}
                          </h3>
                          {system.management && (
                            <div className="flex items-center text-gray-600">
                              <Building2 className="w-4 h-4 mr-2" />
                              <span className="text-sm">{system.management}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {waterSources.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {waterSources.map((item, idx) => (
                            <div key={idx} className="space-y-2">
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${item.color}`}>
                                {item.icon}
                                <span className="text-sm font-medium">{item.type}</span>
                              </div>
                              <p className="text-sm text-gray-600 pl-4">
                                {item.sources}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {system.area_text && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-1">供水區域</p>
                              <p className="text-sm text-gray-600 whitespace-pre-line">
                                {system.area_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* No Results */}
        {selectedDistrict && searchResults.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <svg className="w-12 h-12 text-cyan-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-600 mb-2">
              很抱歉，找不到 <span className="font-semibold text-gray-900">{selectedCity}{selectedDistrict}</span> 的水源資料
            </p>
            <div className="mt-4 max-w-2xl mx-auto">
              <div className="bg-gradient-to-br from-cyan-50 to-teal-50 border border-cyan-200 rounded-xl p-4 text-left">
                <p className="text-sm text-cyan-900 mb-2">
                  <strong>💡 說明：</strong>
                </p>
                <p className="text-sm text-cyan-800">
                  本系統收錄「臺灣自來水公司」與「臺北自來水事業處」的供水資料。
                  部分地區可能尚未納入資料庫中。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Social Links */}
        <div className="mt-16 pt-8 border-t border-gray-300 relative">
          {/* Decorative River Element */}
          <div className="absolute bottom-0 left-0 w-full h-32 opacity-20 pointer-events-none">
            <img 
              src="/river-banner-2.jpg" 
              alt="" 
              className="w-full h-full object-cover object-top"
              style={{mixBlendMode: 'multiply'}}
            />
          </div>
          
          <div className="flex flex-col items-center gap-6 relative z-10">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="河川之初" className="h-8 object-contain" style={{background: 'transparent'}} />
              <span className="text-gray-600 text-sm">讓我們與河流重修舊好</span>
            </div>
            <div className="flex gap-6">
              <a 
                href="https://www.facebook.com/river.udn/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 transition-colors"
              >
                <Facebook className="w-6 h-6" />
                <span className="text-sm">Facebook</span>
              </a>
              <a 
                href="https://www.instagram.com/taiwanriver/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 transition-colors"
              >
                <Instagram className="w-6 h-6" />
                <span className="text-sm">Instagram</span>
              </a>
              <a 
                href="https://www.youtube.com/channel/UC9T3NLUe8cOUFxHce55O15Q" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 transition-colors"
              >
                <Youtube className="w-6 h-6" />
                <span className="text-sm">YouTube</span>
              </a>
              <a 
                href="https://river.udn.com/river/index" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 transition-colors"
              >
                <Globe className="w-6 h-6" />
                <span className="text-sm">官網</span>
              </a>
            </div>
            <p className="text-xs text-gray-500">
              © 2026 河好如初 ReRiver
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </main>
  )
}
